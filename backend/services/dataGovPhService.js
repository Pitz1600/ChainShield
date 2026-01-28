/**
 * Data.gov.ph Integration Service
 * Scans and ingests Philippine government data from data.gov.ph
 * 
 * Reference: https://data.gov.ph/index/home
 */

const axios = require('axios');
const crypto = require('crypto');

class DataGovPhService {
  constructor() {
    this.baseUrl = 'https://data.gov.ph/api/action';
    this.datasetUrl = 'https://data.gov.ph/api/action/package_search';
    this.resourceUrl = 'https://data.gov.ph/api/action/datastore_search';
  }

  /**
   * Search for datasets on data.gov.ph
   * @param {string} query - Search query (e.g., "budget", "procurement", "welfare")
   * @param {number} limit - Number of results
   */
  async searchDatasets(query = '', limit = 10) {
    try {
      const response = await axios.get(this.datasetUrl, {
        params: {
          q: query,
          rows: limit,
          sort: 'metadata_modified desc'
        },
        timeout: 10000
      });

      if (response.data && response.data.result && response.data.result.results) {
        return response.data.result.results.map(dataset => ({
          id: dataset.id,
          name: dataset.name,
          title: dataset.title,
          organization: dataset.organization?.title || 'Unknown',
          tags: dataset.tags?.map(t => t.name) || [],
          resources: dataset.resources?.length || 0,
          modified: dataset.metadata_modified
        }));
      }

      return [];
    } catch (error) {
      console.error('Error searching data.gov.ph:', error.message);
      return [];
    }
  }

  /**
   * Get dataset resources
   * @param {string} resourceId - Resource ID from dataset
   */
  async getResourceData(resourceId, limit = 100) {
    try {
      const response = await axios.get(this.resourceUrl, {
        params: {
          resource_id: resourceId,
          limit: limit
        },
        timeout: 15000
      });

      if (response.data && response.data.result && response.data.result.records) {
        return response.data.result.records;
      }

      return [];
    } catch (error) {
      console.error('Error fetching resource data:', error.message);
      return [];
    }
  }

  /**
   * Convert data.gov.ph data to ChainShield transaction format
   * @param {Object} record - Record from data.gov.ph
   * @param {Object} metadata - Additional metadata
   */
  convertToTransaction(record, metadata = {}) {
    // Extract relevant fields (adjust based on actual data.gov.ph structure)
    const amount = this.extractAmount(record);
    const agency = this.extractAgency(record, metadata);
    const programName = this.extractProgram(record, metadata);
    const transactionType = this.determineTransactionType(record, metadata);

    // Generate addresses (simulated - in real system, these would be actual wallet addresses)
    const fromAddress = this.generateAddress(agency || 'GOV');
    const toAddress = this.generateAddress(record.beneficiary_id || record.id || 'BENEFICIARY');

    return {
      transactionType: transactionType,
      agency: agency || 'Unknown',
      programName: programName || 'Unknown',
      fromAddress: fromAddress,
      toAddress: toAddress,
      amount: amount,
      currency: 'PHP',
      beneficiaryType: this.determineBeneficiaryType(record),
      timestamp: this.extractTimestamp(record),
      metadata: {
        source: 'data.gov.ph',
        resourceId: metadata.resourceId,
        datasetId: metadata.datasetId,
        originalData: record
      }
    };
  }

  /**
   * Extract amount from record
   */
  extractAmount(record) {
    // Try common field names
    const amountFields = ['amount', 'value', 'total', 'budget', 'allocation', 'disbursement'];
    
    for (const field of amountFields) {
      if (record[field]) {
        const value = parseFloat(record[field]);
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }
    }

    // Default random amount for prototype (if no amount found)
    return Math.floor(Math.random() * 100000) + 10000;
  }

  /**
   * Extract agency from record
   */
  extractAgency(record, metadata) {
    // Try common field names
    const agencyFields = ['agency', 'department', 'organization', 'office'];
    
    for (const field of agencyFields) {
      if (record[field]) {
        return record[field];
      }
    }

    // Check metadata
    if (metadata.organization) {
      return metadata.organization;
    }

    // Map common Philippine government agencies
    const agencyMap = {
      'dswd': 'DSWD',
      'department of social welfare': 'DSWD',
      'doh': 'DOH',
      'department of health': 'DOH',
      'dilg': 'DILG',
      'department of interior': 'DILG',
      'dof': 'DOF',
      'department of finance': 'DOF',
      'dti': 'DTI',
      'department of trade': 'DTI'
    };

    const searchText = JSON.stringify(record).toLowerCase();
    for (const [key, value] of Object.entries(agencyMap)) {
      if (searchText.includes(key)) {
        return value;
      }
    }

    return 'Unknown';
  }

  /**
   * Extract program name
   */
  extractProgram(record, metadata) {
    const programFields = ['program', 'project', 'initiative', 'scheme'];
    
    for (const field of programFields) {
      if (record[field]) {
        return record[field];
      }
    }

    // Map common Philippine programs
    const programMap = {
      '4ps': '4Ps',
      'pantawid': '4Ps',
      'sap': 'SAP',
      'social amelioration': 'SAP',
      'tupad': 'TUPAD',
      'aics': 'AICS',
      'assistance': 'AICS'
    };

    const searchText = JSON.stringify(record).toLowerCase();
    for (const [key, value] of Object.entries(programMap)) {
      if (searchText.includes(key)) {
        return value;
      }
    }

    return 'Unknown';
  }

  /**
   * Determine transaction type
   */
  determineTransactionType(record, metadata) {
    const text = JSON.stringify(record).toLowerCase();
    
    if (text.includes('welfare') || text.includes('benefit') || text.includes('aid') || text.includes('assistance')) {
      return 'Social Welfare';
    }
    if (text.includes('procurement') || text.includes('purchase') || text.includes('contract')) {
      return 'Procurement';
    }
    if (text.includes('grant') || text.includes('funding')) {
      return 'Grant';
    }
    if (text.includes('tax') || text.includes('revenue')) {
      return 'Tax';
    }
    
    return 'Other';
  }

  /**
   * Determine beneficiary type
   */
  determineBeneficiaryType(record) {
    const text = JSON.stringify(record).toLowerCase();
    
    if (text.includes('household') || text.includes('family')) {
      return 'Household';
    }
    if (text.includes('organization') || text.includes('company') || text.includes('corp')) {
      return 'Organization';
    }
    if (text.includes('government') || text.includes('agency')) {
      return 'Government Entity';
    }
    
    return 'Individual';
  }

  /**
   * Extract timestamp
   */
  extractTimestamp(record) {
    const dateFields = ['date', 'timestamp', 'created', 'modified', 'disbursement_date'];
    
    for (const field of dateFields) {
      if (record[field]) {
        const date = new Date(record[field]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return new Date();
  }

  /**
   * Generate deterministic address from string
   */
  generateAddress(seed) {
    const hash = crypto.createHash('sha256').update(seed.toString()).digest('hex');
    return '0x' + hash.substring(0, 40);
  }

  /**
   * Scan and ingest data from data.gov.ph
   * @param {Object} options - Scan options
   */
  async scanAndIngest(options = {}) {
    const {
      query = 'budget OR procurement OR welfare',
      limit = 10,
      resourceLimit = 50
    } = options;

    try {
      console.log(`Scanning data.gov.ph for: ${query}`);
      
      // Search for datasets
      const datasets = await this.searchDatasets(query, limit);
      console.log(`Found ${datasets.length} datasets`);

      const transactions = [];

      // Process each dataset
      for (const dataset of datasets) {
        try {
          // Get dataset details to find resources
          const datasetDetails = await this.getDatasetDetails(dataset.id);
          
          if (datasetDetails && datasetDetails.resources) {
            for (const resource of datasetDetails.resources.slice(0, 3)) { // Limit to 3 resources per dataset
              try {
                const records = await this.getResourceData(resource.id, resourceLimit);
                
                for (const record of records) {
                  const transaction = this.convertToTransaction(record, {
                    resourceId: resource.id,
                    datasetId: dataset.id,
                    organization: dataset.organization
                  });
                  
                  transactions.push(transaction);
                }
              } catch (error) {
                console.error(`Error processing resource ${resource.id}:`, error.message);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing dataset ${dataset.id}:`, error.message);
        }
      }

      console.log(`Converted ${transactions.length} records to transactions`);
      return transactions;
    } catch (error) {
      console.error('Error scanning data.gov.ph:', error.message);
      return [];
    }
  }

  /**
   * Get dataset details
   */
  async getDatasetDetails(datasetId) {
    try {
      const response = await axios.get(`${this.baseUrl}/package_show`, {
        params: { id: datasetId },
        timeout: 10000
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return null;
    } catch (error) {
      console.error('Error fetching dataset details:', error.message);
      return null;
    }
  }
}

module.exports = new DataGovPhService();
