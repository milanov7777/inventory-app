export function detectCarrier(trackingNumber) {
  if (!trackingNumber) return { name: 'Unknown', url: null, color: 'bg-gray-100 text-gray-600' }
  const t = trackingNumber.trim().toUpperCase()
  if (t.startsWith('1Z')) {
    return { name: 'UPS', url: `https://www.ups.com/track?tracknum=${t}`, color: 'bg-amber-100 text-amber-800' }
  }
  if (/^(94|93|92|91|90|87|82|71|70|46|45|20|23|48|49)\d{18,}$/.test(t) || /^[0-9]{20,22}$/.test(t)) {
    return { name: 'USPS', url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`, color: 'bg-blue-100 text-blue-800' }
  }
  if (/^\d{12}$/.test(t) || /^\d{15}$/.test(t) || /^\d{20}$/.test(t) || t.startsWith('96') || t.startsWith('98')) {
    return { name: 'FedEx', url: `https://www.fedex.com/apps/fedextrack/?tracknumbers=${t}`, color: 'bg-purple-100 text-purple-800' }
  }
  if (/^[0-9]{10}$/.test(t) || t.startsWith('JD') || t.startsWith('GM')) {
    return { name: 'DHL', url: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${t}`, color: 'bg-red-100 text-red-800' }
  }
  // Default to FedEx
  return { name: 'FedEx', url: `https://www.fedex.com/apps/fedextrack/?tracknumbers=${t}`, color: 'bg-purple-100 text-purple-800' }
}
