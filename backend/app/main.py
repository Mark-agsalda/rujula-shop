import os,datetime
from fastapi import FastAPI,Depends,HTTPException,Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_
from .database import Base,engine,get_db
from .models import User,Product,Address,ShippingRule,Order,OrderItem
from .security import hash_password,verify_password,make_token,decode_token
app=FastAPI(title="Rujula Shop API", version="1.0.0")
_cors_raw=os.getenv("CORS_ORIGINS","*").strip()
_cors_origins=[x.strip() for x in _cors_raw.split(",") if x.strip()] if _cors_raw else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(engine)
def seed(db):
 if not db.query(User).filter(User.role=="seller").first(): db.add(User(name="Rujula Seller",email=os.getenv("SELLER_EMAIL","seller@rujula.local"),password_hash=hash_password(os.getenv("SELLER_PASSWORD","ChangeMe123!")),role="seller"))
 if not db.query(ShippingRule).filter(ShippingRule.municipality.ilike("Diffun")).first(): db.add(ShippingRule(municipality="Diffun",province="Quirino",fee=0))
 db.commit()
with next(get_db()) as d: seed(d)
class Register(BaseModel): name:str; email:EmailStr; phone:str=""; password:str
class Login(BaseModel): email:EmailStr; password:str
class ProductIn(BaseModel): name:str; category:str; price:float; description:str=""; image_url:str=""; stock:int=0
class AddressIn(BaseModel): label:str="Home"; full_name:str; phone:str; address_line:str; barangay:str=""; municipality:str; province:str; postal_code:str=""
class ShippingIn(BaseModel): municipality:str; province:str; fee:float
class Item(BaseModel): product_id:int; quantity:int
class Checkout(BaseModel): address_id:int; items:list[Item]
def current(db,auth):
 if not auth or not auth.startswith("Bearer "): raise HTTPException(401,"Login required")
 try: return db.get(User,int(decode_token(auth[7:])["sub"]))
 except: raise HTTPException(401,"Invalid token")
def clean(x):
 d=x.__dict__.copy(); d.pop("_sa_instance_state",None); return d
@app.get("/api/health")
def health(): return {"ok":True}
@app.post("/api/auth/register")
def register(x:Register,db:Session=Depends(get_db)):
 if db.query(User).filter(User.email==x.email).first(): raise HTTPException(400,"Email already registered")
 u=User(name=x.name,email=x.email,phone=x.phone,password_hash=hash_password(x.password),role="customer"); db.add(u);db.commit();db.refresh(u);return {"token":make_token(u.id,u.role),"user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role}}
@app.post("/api/auth/login")
def login(x:Login,db:Session=Depends(get_db)):
 u=db.query(User).filter(User.email==x.email).first()
 if not u or not verify_password(x.password,u.password_hash): raise HTTPException(401,"Invalid email or password")
 return {"token":make_token(u.id,u.role),"user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role}}
@app.get("/api/products")
def products(q:str="",category:str="",db:Session=Depends(get_db)):
 x=db.query(Product).filter(Product.active==True)
 if q:x=x.filter(or_(Product.name.ilike(f"%{q}%"),Product.description.ilike(f"%{q}%")))
 if category:x=x.filter(Product.category==category)
 return [clean(p) for p in x.order_by(Product.id.desc()).all()]
@app.get("/api/categories")
def categories(db:Session=Depends(get_db)): return [x[0] for x in db.query(Product.category).distinct().all()]
@app.post("/api/products")
def add_product(x:ProductIn,authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 p=Product(**x.model_dump());db.add(p);db.commit();db.refresh(p);return clean(p)
@app.put("/api/products/{pid}")
def edit_product(pid:int,x:ProductIn,authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 p=db.get(Product,pid)
 if not p:raise HTTPException(404,"Not found")
 for k,v in x.model_dump().items():setattr(p,k,v)
 db.commit();return clean(p)
@app.delete("/api/products/{pid}")
def del_product(pid:int,authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 p=db.get(Product,pid)
 if p:p.active=False;db.commit()
 return {"ok":True}
@app.get("/api/me/addresses")
def addresses(authorization:str=Header(None),db:Session=Depends(get_db)):
 u=current(db,authorization);return [clean(a) for a in db.query(Address).filter(Address.user_id==u.id).all()]
@app.post("/api/me/addresses")
def add_address(x:AddressIn,authorization:str=Header(None),db:Session=Depends(get_db)):
 u=current(db,authorization);a=Address(user_id=u.id,**x.model_dump());db.add(a);db.commit();db.refresh(a);return clean(a)
@app.get("/api/shipping")
def shipping(db:Session=Depends(get_db)):return [clean(x) for x in db.query(ShippingRule).all()]
@app.post("/api/shipping")
def set_shipping(x:ShippingIn,authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 s=db.query(ShippingRule).filter(ShippingRule.municipality==x.municipality,ShippingRule.province==x.province).first()
 if s:s.fee=x.fee
 else:db.add(ShippingRule(**x.model_dump()))
 db.commit();return {"ok":True}
@app.post("/api/orders")
def order(x:Checkout,authorization:str=Header(None),db:Session=Depends(get_db)):
 u=current(db,authorization);a=db.get(Address,x.address_id)
 if not a or a.user_id!=u.id:raise HTTPException(400,"Invalid address")
 subtotal=0;items=[]
 for i in x.items:
  p=db.get(Product,i.product_id)
  if not p or not p.active or i.quantity<1 or i.quantity>p.stock:raise HTTPException(400,"Invalid stock")
  subtotal+=p.price*i.quantity;items.append((p,i.quantity))
 if a.municipality.strip().lower()=="diffun":fee=0
 else:
  r=db.query(ShippingRule).filter(ShippingRule.municipality.ilike(a.municipality),ShippingRule.province.ilike(a.province)).first();fee=r.fee if r else 0
 o=Order(user_id=u.id,address_id=a.id,subtotal=subtotal,shipping_fee=fee,total=subtotal+fee,status="Pending",created_at=datetime.datetime.now().isoformat());db.add(o);db.flush()
 for p,q in items:p.stock-=q;db.add(OrderItem(order_id=o.id,product_id=p.id,product_name=p.name,price=p.price,quantity=q))
 db.commit();return {"order_id":o.id,"subtotal":subtotal,"shipping_fee":fee,"total":subtotal+fee,"status":o.status}
@app.get("/api/orders")
def orders(authorization:str=Header(None),db:Session=Depends(get_db)):
 u=current(db,authorization);return [clean(o) for o in db.query(Order).filter(Order.user_id==u.id).order_by(Order.id.desc()).all()]
@app.get("/api/seller/orders")
def seller_orders(authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 return [clean(o) for o in db.query(Order).order_by(Order.id.desc()).all()]
@app.patch("/api/seller/orders/{oid}")
def status(oid:int,status:str,authorization:str=Header(None),db:Session=Depends(get_db)):
 if current(db,authorization).role!="seller":raise HTTPException(403,"Seller only")
 if status not in {"Pending","Confirmed","Shipped","Delivered","Cancelled"}:raise HTTPException(400,"Invalid status")
 o=db.get(Order,oid)
 if not o:raise HTTPException(404,"Order not found")
 o.status=status;db.commit();return {"ok":True}
