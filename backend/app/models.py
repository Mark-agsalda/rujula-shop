from sqlalchemy import String,Integer,Float,Boolean,ForeignKey,Text
from sqlalchemy.orm import Mapped,mapped_column
from .database import Base
class User(Base):
 __tablename__="users"; id:Mapped[int]=mapped_column(primary_key=True); name:Mapped[str]=mapped_column(String(120)); email:Mapped[str]=mapped_column(String(255),unique=True,index=True); phone:Mapped[str]=mapped_column(String(40),default=""); password_hash:Mapped[str]=mapped_column(String(255)); role:Mapped[str]=mapped_column(String(20),default="customer")
class Address(Base):
 __tablename__="addresses"; id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey("users.id")); label:Mapped[str]=mapped_column(String(80),default="Home"); full_name:Mapped[str]=mapped_column(String(120)); phone:Mapped[str]=mapped_column(String(40)); address_line:Mapped[str]=mapped_column(String(255)); barangay:Mapped[str]=mapped_column(String(120),default=""); municipality:Mapped[str]=mapped_column(String(120)); province:Mapped[str]=mapped_column(String(120)); postal_code:Mapped[str]=mapped_column(String(20),default=""); is_default:Mapped[bool]=mapped_column(Boolean,default=False)
class Product(Base):
 __tablename__="products"; id:Mapped[int]=mapped_column(primary_key=True); name:Mapped[str]=mapped_column(String(180)); category:Mapped[str]=mapped_column(String(100),index=True); price:Mapped[float]=mapped_column(Float); description:Mapped[str]=mapped_column(Text,default=""); image_url:Mapped[str]=mapped_column(String(500),default=""); stock:Mapped[int]=mapped_column(Integer,default=0); active:Mapped[bool]=mapped_column(Boolean,default=True)
class ShippingRule(Base):
 __tablename__="shipping_rules"; id:Mapped[int]=mapped_column(primary_key=True); municipality:Mapped[str]=mapped_column(String(120)); province:Mapped[str]=mapped_column(String(120)); fee:Mapped[float]=mapped_column(Float,default=0)
class Order(Base):
 __tablename__="orders"; id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey("users.id")); address_id:Mapped[int]=mapped_column(ForeignKey("addresses.id")); subtotal:Mapped[float]=mapped_column(Float); shipping_fee:Mapped[float]=mapped_column(Float); total:Mapped[float]=mapped_column(Float); status:Mapped[str]=mapped_column(String(30),default="Pending"); created_at:Mapped[str]=mapped_column(String(40))
class OrderItem(Base):
 __tablename__="order_items"; id:Mapped[int]=mapped_column(primary_key=True); order_id:Mapped[int]=mapped_column(ForeignKey("orders.id")); product_id:Mapped[int]=mapped_column(ForeignKey("products.id")); product_name:Mapped[str]=mapped_column(String(180)); price:Mapped[float]=mapped_column(Float); quantity:Mapped[int]=mapped_column(Integer)
