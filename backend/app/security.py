import os
from datetime import datetime,timedelta,timezone
from jose import jwt
from passlib.context import CryptContext
SECRET=os.getenv("JWT_SECRET","dev-only-change-me"); pwd=CryptContext(schemes=["bcrypt"],deprecated="auto")
def hash_password(p): return pwd.hash(p)
def verify_password(p,h): return pwd.verify(p,h)
def make_token(uid,role): return jwt.encode({"sub":str(uid),"role":role,"exp":datetime.now(timezone.utc)+timedelta(days=7)},SECRET,algorithm="HS256")
def decode_token(t): return jwt.decode(t,SECRET,algorithms=["HS256"])
