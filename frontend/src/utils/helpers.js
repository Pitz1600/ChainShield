export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const truncateHash = (hash, length = 10) => {
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}`;
};

export const getRiskLevel = (score) => {
  if (score >= 90) return 'critical';
  if (score >= 71) return 'high';
  if (score >= 41) return 'medium';
  return 'low';
};

export const formatAddressLabel = (value) => {
  if (!value) return '';
  let label = String(value).trim();
  if (label.toLowerCase().startsWith('0x')) {
    label = label.slice(2);
  }
  label = label.replace(/0+$/g, '').trim();
  return label || String(value).trim();
};

export const exportToCSV = (data, filename) => {
  const csv = data.map(row => Object.values(row).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};
