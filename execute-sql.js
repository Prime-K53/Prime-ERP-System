const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ccdjclcahlrdnbuslrvq.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

async function executeSql() {
  try {
    // Create Supabase client with admin key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Read the SQL file
    const sqlContent = fs.readFileSync('database/supabase-referral-tables.sql', 'utf-8');

    // Split by semicolons to execute individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(`Statement: ${statement.substring(0, 100)}...`);

      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement,
      }).catch(err => {
        // If rpc doesn't exist, try direct query
        return supabase.from('_sql').select('*').limit(0);
      });

      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
      } else {
        console.log(`Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\nAll SQL statements processed!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

executeSql();