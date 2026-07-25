import pymongo
client = pymongo.MongoClient('mongodb+srv://chainshield65_db_user:LzewBTl3kycc5cDY@chainshield.g8xlb6j.mongodb.net/chainshield?appName=ChainShield')
db = client['chainshield']
users = db['users']
result = users.update_many({}, {'$set': {'mustChangePassword': False, 'mustSetup2FA': False, 'isVerified': True}})
print('Updated', result.modified_count, 'users')
client.close()
