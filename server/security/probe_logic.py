"""Integration probes against a configured Oracle schema; writes disposable fixtures.
Run explicitly: python3 server/security/probe_logic.py --run
"""
import json,secrets,sys
if '--run' not in sys.argv:
 raise SystemExit('Explicit --run required: creates and removes security fixtures in the configured database.')
from pathlib import Path
from db_access import connect
import oracledb
prefix='sec'+secrets.token_hex(5)
accounts=[prefix+'a',prefix+'b']; players=[prefix+'pa',prefix+'pb',prefix+'pc']; games=[prefix+'legacy',prefix+'own',prefix+'forged',prefix+'foreign']
tokens=[secrets.token_hex(32),secrets.token_hex(32)]
results=[]
c=connect();cur=c.cursor()
def call(label,fn):
 try:
  value=fn(); results.append({'test':label,'allowed':True});return value
 except oracledb.DatabaseError as e:
  c.rollback();results.append({'test':label,'allowed':False,'oracle_code':e.args[0].code});return None

def payload(gid,ps=None,forged=False):
 ps=ps or players[1:]
 return json.dumps({'id':gid,'mode':'classica','numPlayers':2,'startDealerId':ps[0], 'createdAt':'2026-09-15T12:00:00Z','finishedAt':'2026-09-15T12:01:00Z','players':[{'id':p,'name':'Security fixture','seatOrder':i+1} for i,p in enumerate(ps)],'rounds':[{'index':1,'cardsDealt':25,'presaValue':5,'rispettoValue':10,'dealerId':ps[0],'results':[{'playerId':p,'bid':0,'respected':True,'scarto':0,'score':999999 if forged else 10} for p in ps]}]}).encode()
try:
 for i,a in enumerate(accounts):
  cur.execute("insert into taotl_accounts(id,handle_normalized,display_name,password_salt,password_hash,email) values(:a,:h,:n,:s,:p,:e)",a=a,h=a,n='Security fixture',s=secrets.token_hex(32),p=secrets.token_hex(32),e=a+'@example.invalid')
  cur.execute("insert into taotl_sessions(token_hash,account_id,expires_at) values(taotl_identity_api.sha256(:t),:a,SYSTIMESTAMP+INTERVAL '1' HOUR)",t=tokens[i],a=a)
 for i,p in enumerate(players):
  cur.execute('insert into players(id,name,owner_account_id) values(:p,:n,:a)',p=p,n='Security '+p,a=accounts[0 if i==0 else 1])
 for i,g in enumerate(games[:2]):
  cur.execute("insert into games(id,game_mode,num_players,start_dealer_id,created_at,finished_at,leaderboard_id,owner_account_id) values(:g,'classica',2,:p,SYSTIMESTAMP,SYSTIMESTAMP,NULL,:a)",g=g,p=players[0],a=None if i==0 else accounts[0])
 cur.execute('insert into game_players(game_id,player_id,seat_order) values(:g,:p,1)',g=games[1],p=players[1])
 c.commit()
 call('Non-admin reads admin accounts',lambda:cur.callfunc('taotl_identity_api.list_accounts',oracledb.DB_TYPE_CLOB,['Bearer '+tokens[1]]))
 call('Account B reads game owned by A',lambda:cur.callfunc('taotl_api.get_game',oracledb.DB_TYPE_CLOB,['Bearer '+tokens[1],games[1]]))
 call('Account B overwrites game owned by A',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[1])]))
 call('Account B overwrites game with NULL owner',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[0])]))
 call('Valid own game sync',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[2])]))
 call('Valid repeated game sync',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[2])]))
 call('Forged score accepted',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[2],forged=True)]))
 call('Foreign private player accepted',lambda:cur.callproc('taotl_api.sync_game',['Bearer '+tokens[1],payload(games[3],ps=players[:2])]))
 import base64
 image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vXcAAAAASUVORK5CYII=')
 call('Valid PNG photo',lambda:cur.callproc('taotl_api.update_player_photo',['Bearer '+tokens[1],players[1],image,'image/png']))
 call('HTML uploaded as player photo',lambda:cur.callproc('taotl_api.update_player_photo',['Bearer '+tokens[1],players[1],b'<script>window.__taotl_probe=1</script>','text/html']))
 call('HTML pretending to be PNG',lambda:cur.callproc('taotl_api.update_player_photo',['Bearer '+tokens[1],players[1],b'<script>window.__taotl_probe=1</script>','image/png']))
 call('SQL injection in login',lambda:cur.callfunc('taotl_identity_api.login_account',oracledb.DB_TYPE_CLOB,[json.dumps({'handle':"' OR 1=1 --",'password':'NoValidPassword1'}).encode()]))
 room=cur.callfunc('taotl_identity_api.create_room',oracledb.DB_TYPE_CLOB,['Bearer '+tokens[1]])
 roomid=json.loads(room.read())['id']
 call('Own room attached to foreign game',lambda:cur.callfunc('taotl_identity_api.complete_room_game',oracledb.DB_TYPE_CLOB,['Bearer '+tokens[1],json.dumps({'roomId':roomid,'gameId':games[1]}).encode()]))
 print(json.dumps(results,indent=2))
 assert all(r['allowed'] == (r['test'] in ('Valid own game sync','Valid repeated game sync','Valid PNG photo')) for r in results),results
 for r in results:
  if not r['allowed']:
   assert r['oracle_code'] in (20400,20401,20403,20404),r
finally:
 c.rollback()
 for g in games:cur.execute('delete from games where id=:g',g=g)
 for a in accounts:cur.execute('delete from taotl_game_rooms where host_account_id=:a',a=a)
 for p in players:cur.execute('delete from players where id=:p',p=p)
 for a in accounts:cur.execute('delete from taotl_accounts where id=:a',a=a)
 c.commit();c.close()
 print('Test fixtures removed')
