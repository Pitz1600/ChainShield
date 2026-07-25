const CSVColumnMapper = require('./utils/csvColumnMapper');
const mapper = new CSVColumnMapper();
const headers = ['record_id', 'amount', 'agency', 'program_name', 'payer_name', 'payee_name', 'transaction_type', 'description_raw', 'post_date'];
const mappings = mapper.detectColumns(headers);
console.log('Mappings:', mappings);

const row = {
    'record_id': 'TXN-001',
    'amount': '1000',
    'agency': 'DOH',
    'program_name': 'Health',
    'payer_name': '0x123',
    'payee_name': '0x456',
    'transaction_type': 'Procurement',
    'description_raw': 'Test',
    'post_date': '2023-01-01'
};

const tx = mapper.mapRow(row, mappings);
console.log('Mapped TX:', tx);
