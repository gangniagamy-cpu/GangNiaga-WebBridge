import os, sqlite3, shutil

userData = r'C:\Users\megat\AppData\Local\Google\Chrome\User Data'

for d in sorted(os.listdir(userData)):
    loginDB = os.path.join(userData, d, 'Login Data')
    if os.path.isfile(loginDB):
        try:
            tmp = r'D:\GangNiaga-WebBridge\tmp_logindata.db'
            shutil.copy2(loginDB, tmp)
            conn = sqlite3.connect(tmp)
            c = conn.cursor()
            c.execute("SELECT origin_url, username_value FROM logins WHERE username_value != ''")
            rows = c.fetchall()
            if rows:
                print(f'=== {d} ===')
                for url, user in rows:
                    print(f'  {url[:60]:60} | {user}')
            conn.close()
            os.remove(tmp)
        except:
            pass
