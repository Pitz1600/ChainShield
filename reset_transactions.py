import pymongo

client = pymongo.MongoClient('mongodb+srv://chainshield65_db_user:LzewBTl3kycc5cDY@chainshield.g8xlb6j.mongodb.net/chainshield?appName=ChainShield')
db = client['chainshield']

# Reset transactions data
transactions = db['transactions']
result_tx = transactions.delete_many({})
print('Deleted', result_tx.deleted_count, 'transactions')

# Undo the bypass for the auditor account
users = db['users']
result_user = users.update_one(
    {'email': 'auditor@example.com'}, 
    {'$set': {'mustChangePassword': True}}
)
print('Reinstated password requirement for auditor:', result_user.modified_count)

# Also for auditor@chainshield.gov.ph if it exists
result_user2 = users.update_one(
    {'email': 'auditor@chainshield.gov.ph'}, 
    {'$set': {'mustChangePassword': True}}
)
print('Reinstated password requirement for auditor@chainshield.gov.ph:', result_user2.modified_count)

client.close()
