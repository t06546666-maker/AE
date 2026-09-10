const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkNetworks() {
  const { data, error } = await supabase.from('networks').select('id, name').limit(5);
  if (error) {
    console.error('Error fetching networks:', error);
  } else {
    console.log('Networks:', data);
  }
}

checkNetworks();
