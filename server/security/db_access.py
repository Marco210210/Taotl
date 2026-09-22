import os,shlex
from pathlib import Path
import oracledb

def connect():
 values={}
 for path in [Path.home()/'.config/taotl/credentials.env',Path.home()/'.config/taotl-mail.env']:
  for line in path.read_text().splitlines():
   if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
   k,v=line.split('=',1)
   parts=shlex.split(v)
   values[k.strip()]=parts[0] if len(parts)==1 else v
 wallet=values.get('TAOTL_ORACLE_WALLET_DIR',str(Path.home()/'.config/taotl/wallet'))
 return oracledb.connect(user='taotl_app',password=values['TAOTL_SCHEMA_PASSWORD'],dsn=values.get('TAOTL_ORACLE_DSN','MYATP_high_tls'),config_dir=wallet,wallet_location=wallet,wallet_password=values['ORACLE_WALLET_PASSWORD'])
