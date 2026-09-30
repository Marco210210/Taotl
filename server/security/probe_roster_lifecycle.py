import json,secrets,oracledb,base64,sys
from db_access import connect
if '--run' not in sys.argv:
 raise SystemExit('Use --run to create and remove disposable Oracle fixtures; --browser also checks the published admin UI.')
prefix='seclife'+secrets.token_hex(4);owner,linked,admin=[prefix+x for x in ['o','l','a']];board,player,game=[prefix+x for x in ['b','p','g']];tokens={x:secrets.token_hex(32) for x in [owner,linked,admin]}
with connect() as c:
 cur=c.cursor();cur.execute('ALTER SESSION DISABLE PARALLEL DML')
 def body(d):return json.dumps(d).encode()
 def fn(name,*args):return json.loads(cur.callfunc(name,oracledb.DB_TYPE_CLOB,list(args)).read())
 def auth(a):return 'Bearer '+tokens[a]
 try:
  for a in tokens:
   cur.execute("insert into taotl_accounts(id,handle_normalized,display_name,password_salt,password_hash,email,is_admin) values(:a,:a,:n,:s,:h,:e,:r)",a=a,n=prefix,s=secrets.token_hex(32),h=secrets.token_hex(32),e=a+'@example.invalid',r='Y' if a==admin else 'N')
   cur.execute("insert into taotl_sessions(token_hash,account_id,expires_at) values(taotl_identity_api.sha256(:t),:a,SYSTIMESTAMP+INTERVAL '1' HOUR)",t=tokens[a],a=a)
  cur.execute('insert into players(id,name,owner_account_id) values(:p,:n,:a)',p=player,n=prefix,a=linked)
  cur.execute('insert into taotl_account_players(account_id,player_id) values(:a,:p)',a=linked,p=player)
  cur.execute("insert into taotl_leaderboards(id,name,owner_account_id,visibility) values(:b,:b,:a,'private')",b=board,a=owner)
  for a,r in [(owner,'owner'),(linked,'viewer')]:cur.execute("insert into taotl_account_leaderboards(account_id,leaderboard_id,role,is_default) values(:a,:b,:r,'N')",a=a,b=board,r=r)
  cur.execute('insert into taotl_leaderboard_players(leaderboard_id,player_id,added_by) values(:b,:p,:a)',b=board,p=player,a=owner)
  cur.execute("insert into games(id,game_mode,num_players,start_dealer_id,created_at,finished_at,is_manual,winner_player_id,counts_for_win_rate,leaderboard_id,owner_account_id) values(:g,'manuale',1,:p,SYSTIMESTAMP,SYSTIMESTAMP,'Y',:p,'N',:b,:a)",g=game,p=player,b=board,a=owner)
  cur.execute('insert into game_players(game_id,player_id,seat_order) values(:g,:p,1)',g=game,p=player);c.commit()
  stats=fn('taotl_identity_api.overall_leaderboard',board);assert stats[0]['wins']==1
  cur.callproc('taotl_collaboration_api.remove_player',[auth(owner),board,player]);assert fn('taotl_identity_api.overall_leaderboard',board)==[]
  cur.execute('select count(*) from games where id=:g',g=game);assert cur.fetchone()[0]==1
  roster=fn('taotl_api.list_players',auth(owner));assert any(p['id']==player for p in roster)
  cur.callproc('taotl_collaboration_api.add_player',[auth(owner),board,body({'playerId':player})]);assert fn('taotl_identity_api.overall_leaderboard',board)[0]['wins']==1
  print('Removal/reinstatement retains historical victory: PASS')
  for a,expected in [(owner,True),(linked,False),(admin,True)]:
   info=fn('taotl_api.get_player',auth(a),player);assert info['linkedAccount'] and info['canEdit']==expected
  print('Roster permissions metadata: manager and superadmin, not viewer: PASS')
  newname=prefix+' renamed'
  cur.callproc('taotl_api.update_player',[auth(owner),player,body({'name':newname,'confirmLinkedRename':True,'expectedName':prefix})])
  acc=fn('taotl_identity_api.my_account',auth(linked));assert acc['displayName']==newname and acc['handle']==linked
  cur.execute('select name from players where id=:p',p=player);assert cur.fetchone()[0]==newname
  png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vXcAAAAASUVORK5CYII=')
  cur.callproc('taotl_api.update_player_photo',[auth(owner),player,png,'image/png'])
  print('Manager renames linked account atomically and changes photo: PASS')
  if '--browser' in sys.argv:
   from playwright.sync_api import sync_playwright
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux/headless_shell',headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844});ctx.add_init_script('localStorage.setItem("taotl.auth-session.v1",'+json.dumps(tokens[admin])+');');page=ctx.new_page();page.goto('https://admin-taotl.130.110.16.97.sslip.io/admin');page.get_by_role('button',name='Classifiche',exact=True).wait_for(timeout=30000);page.get_by_role('button',name='Classifiche',exact=True).click();page.get_by_role('radio',name=board).wait_for();page.get_by_role('radio',name=board).click();page.get_by_role('button',name='Gestisci giocatori, membri e inviti').click();page.get_by_text('Nome e foto',exact=True).click();page.locator('input:visible').first.fill(prefix+' browser')
    page.get_by_role('button',name='Salva',exact=True).click();page.get_by_text('Modificare il nome collegato?',exact=True).wait_for();page.get_by_role('button',name='Continua',exact=True).click();page.get_by_text('Conferma definitiva',exact=True).wait_for();page.get_by_role('button',name='Annulla',exact=True).click();assert fn('taotl_identity_api.my_account',auth(linked))['displayName']==newname
    page.get_by_role('button',name='Salva',exact=True).click();page.get_by_role('button',name='Continua',exact=True).click();page.get_by_role('button',name='Conferma nuovo nome',exact=True).click();page.get_by_text('Rimuovi dalla rosa',exact=True).wait_for();assert fn('taotl_identity_api.my_account',auth(linked))['displayName']==prefix+' browser'
    page.get_by_text('Rimuovi dalla rosa',exact=True).click();page.get_by_text('Confermi la rimozione?',exact=True).wait_for();page.get_by_role('button',name='Annulla',exact=True).click();assert fn('taotl_identity_api.overall_leaderboard',board)[0]['wins']==1
    page.get_by_text('Rimuovi dalla rosa',exact=True).click();page.get_by_role('button',name='Conferma rimozione',exact=True).click();page.get_by_text('La rosa è vuota.',exact=True).wait_for();assert fn('taotl_identity_api.overall_leaderboard',board)==[]
    print('Browser double confirmation, cancellation and removal confirmation: PASS');browser.close()
 finally:
  c.rollback();cur.execute('delete from games where id=:g',g=game)
  cur.execute('delete from taotl_leaderboard_players where leaderboard_id=:b',b=board)
  cur.execute('delete from taotl_account_leaderboards where leaderboard_id=:b',b=board)
  cur.execute('delete from taotl_leaderboards where id=:b',b=board)
  cur.execute('delete from taotl_account_players where player_id=:p',p=player)
  cur.execute('delete from players where id=:p',p=player)
  for a in tokens:cur.execute('delete from taotl_accounts where id=:a',a=a)
  c.commit();print('Lifecycle fixtures removed')
