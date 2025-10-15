#!/usr/bin/env node

/**
 * Production Deployment Test Script for cPanel
 * 
 * This script tests the public job seekers API endpoint that's failing in production
 * with "Invalid count value: -1" error.
 * 
 * Usage:
 * 1. Upload this file to your cPanel public_html directory
 * 2. Run: node production-test.js
 * 3. Check the output for specific error patterns
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Helper function to parse DATABASE_URL
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    // Example: mysql://user:password@host:port/database
    const match = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);
    if (!match) return null;
    
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5].split('?')[0] // Remove any query parameters
    };
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error.message);
    return null;
  }
}

// Test configurations
const tests = [
  {
    name: 'Basic Connection Test',
    test: async (connection) => {
      const [rows] = await connection.execute('SELECT 1 as test');
      return rows[0].test === 1;
    }
  },
  {
    name: 'User Table Count',
    test: async (connection) => {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM User');
      console.log('Total users:', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'Profile Table Count',
    test: async (connection) => {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM Profile');
      console.log('Total profiles:', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'JobCategory Table Count',
    test: async (connection) => {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM JobCategory');
      console.log('Total job categories:', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'Approved Profiles Count',
    test: async (connection) => {
      const [rows] = await connection.execute(
        "SELECT COUNT(*) as count FROM Profile WHERE approvalStatus = 'approved' AND isActive = 1"
      );
      console.log('Approved active profiles:', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'Job Seekers Count (Inner Join)',
    test: async (connection) => {
      const [rows] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM Profile p 
        INNER JOIN User u ON p.userId = u.id 
        WHERE p.approvalStatus = 'approved' 
          AND p.isActive = 1 
          AND u.role = 'jobseeker'
      `);
      console.log('Job seekers (inner join):', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'Job Seekers with Category (Left Join)',
    test: async (connection) => {
      const [rows] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM Profile p
        INNER JOIN User u ON p.userId = u.id
        LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
        WHERE p.approvalStatus = 'approved'
          AND p.isActive = 1
          AND u.role = 'jobseeker'
      `);
      console.log('Job seekers with categories (left join):', rows[0].count);
      return rows[0].count >= 0;
    }
  },
  {
    name: 'Sample Job Seeker Data',
    test: async (connection) => {
      const [rows] = await connection.execute(`
        SELECT 
          p.firstName,
          p.lastName,
          u.id as userId,
          jc.name_en as category_name
        FROM Profile p
        INNER JOIN User u ON p.userId = u.id
        LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
        WHERE p.approvalStatus = 'approved'
          AND p.isActive = 1
          AND u.role = 'jobseeker'
        LIMIT 3
      `);
      console.log('Sample data rows:', rows.length);
      console.log('Sample data:', rows.map(r => ({ 
        name: `${r.firstName} ${r.lastName}`, 
        userId: r.userId,
        category: r.category_name 
      })));
      return true;
    }
  }
];

async function runTests() {
  let connection;
  
  try {
    console.log('🔍 Starting Production Database Tests...\n');
    
    // Parse database configuration
    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    
    if (!dbConfig) {
      console.log('DATABASE_URL:', process.env.DATABASE_URL);
      throw new Error('Could not parse DATABASE_URL. Please check your .env file.');
    }
    
    console.log('📋 Database Config:', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port,
      passwordSet: !!dbConfig.password
    });
    
    // Create MySQL connection
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Database connection established');
    console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.host}\n`);
    
    // Run each test
    for (const testCase of tests) {
      try {
        console.log(`🧪 Running: ${testCase.name}`);
        const result = await testCase.test(connection);
        console.log(result ? '✅ PASS' : '❌ FAIL');
        console.log('---');
      } catch (error) {
        console.log('❌ FAIL - Error:', error.message);
        console.log('SQL State:', error.sqlState);
        console.log('Error Code:', error.code);
        console.log('---');
      }
    }
    
    // Test the problematic API endpoint simulation
    console.log('🎯 Testing API Endpoint Logic...\n');
    
    try {
      // This mimics what the original failing query was doing
      const page = 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // The count query that's been failing
      const countResult = await connection.execute(`
        SELECT COUNT(*) as total
        FROM Profile p
        INNER JOIN User u ON p.userId = u.id
        LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
        WHERE p.approvalStatus = 'approved'
          AND p.isActive = 1
          AND u.role = 'jobseeker'
      `);
      
      console.log('🔍 Raw count result:', countResult);
      console.log('🔍 First row:', countResult[0]);
      console.log('🔍 First row first element:', countResult[0]?.[0]);
      
      // Try different ways to access the count
      let total;
      if (countResult[0] && Array.isArray(countResult[0])) {
        // mysql2 sometimes returns array of rows
        total = countResult[0][0]['COUNT(*)'] || countResult[0][0]['total'] || countResult[0][0][0];
      } else {
        // Direct object access
        total = countResult[0]?.total || countResult.total;
      }
      
      total = Number(total);
      console.log('📊 Total count for API:', total);
      
      if (total === -1) {
        console.log('❌ FOUND THE ISSUE: Count is returning -1');
      } else if (isNaN(total)) {
        console.log('❌ FOUND THE ISSUE: Count is NaN, original value:', total);
      } else {
        console.log('✅ Count query works fine');
      }
      
      // Test the data query
      const [dataResult] = await connection.execute(`
        SELECT 
          p.firstName,
          p.lastName,
          p.gender,
          p.skills,
          p.experience,
          u.id as userId,
          u.createdAt,
          jc.name_en as category_name_en
        FROM Profile p
        INNER JOIN User u ON p.userId = u.id
        LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
        WHERE p.approvalStatus = 'approved'
          AND p.isActive = 1
          AND u.role = 'jobseeker'
        ORDER BY u.createdAt DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
      
      console.log('📄 Data query returned:', dataResult.length, 'rows');
      
    } catch (apiError) {
      console.log('❌ API SIMULATION FAILED:', apiError.message);
      console.log('This is likely the source of your production error');
    }
    
  } catch (error) {
    console.error('💥 Connection failed:', error.message);
    console.error('Code:', error.code);
    console.error('Check your DATABASE_* environment variables');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the tests
runTests().catch(console.error);