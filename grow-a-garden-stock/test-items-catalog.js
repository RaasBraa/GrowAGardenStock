import fetch from 'node-fetch';

async function testItemsCatalog() {
  try {
    console.log('Testing /api/items-catalog endpoint...\n');
    
    const response = await fetch('http://localhost:3000/api/items-catalog');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Endpoint working correctly!');
      console.log(`📅 Timestamp: ${data.timestamp}`);
      console.log(`📦 Version: ${data.version}\n`);
      
      const catalog = data.data;
      
      // Display summary
      console.log('📋 ITEMS CATALOG SUMMARY:');
      console.log('========================');
      
      Object.entries(catalog).forEach(([category, info]) => {
        const itemCount = info.items ? info.items.length : 'N/A';
        const notificationType = info.notificationType || 'individual';
        const defaultEnabled = info.defaultEnabled || [];
        
        console.log(`\n${info.name} (${category})`);
        console.log(`  Description: ${info.description}`);
        console.log(`  Items: ${itemCount}`);
        console.log(`  Notification Type: ${notificationType}`);
        
        if (Array.isArray(defaultEnabled)) {
          console.log(`  Default Enabled Items: ${defaultEnabled.length > 0 ? defaultEnabled.join(', ') : 'None'}`);
        } else {
          console.log(`  Default Enabled: ${defaultEnabled}`);
        }
        
        // Show some sample items if available
        if (info.items && info.items.length > 0) {
          const sampleItems = info.items.slice(0, 3);
          console.log(`  Sample Items: ${sampleItems.map(item => `${item.name} (${item.rarity})`).join(', ')}`);
          if (info.items.length > 3) {
            console.log(`  ... and ${info.items.length - 3} more items`);
          }
        }
      });
      
      // Count totals
      const totalItems = Object.values(catalog).reduce((total, category) => {
        return total + (category.items ? category.items.length : 0);
      }, 0);
      
      console.log(`\n📊 TOTAL ITEMS: ${totalItems}`);
      
    } else {
      console.log('❌ Endpoint returned error:', data);
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
  }
}

testItemsCatalog(); 