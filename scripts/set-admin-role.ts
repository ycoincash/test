#!/usr/bin/env tsx

/**
 * Set Admin Role Script
 * 
 * This script grants admin privileges to a specific user by setting a custom claim.
 * After running this script, the user must sign out and sign back in for the claim to take effect.
 * 
 * Usage: npx tsx scripts/set-admin-role.ts
 */

import { adminAuth } from '../src/lib/firebase/admin-config';

const ADMIN_UID = '6yUTvF9JrBQo3GUEqxhUnfleVOE3';
const ADMIN_EMAIL = 'alsabhibassem@gmail.com';

async function setAdminRole() {
  try {
    console.log('🔐 Setting admin role for user...');
    console.log(`UID: ${ADMIN_UID}`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    
    // Verify the user exists first
    try {
      const user = await adminAuth.getUser(ADMIN_UID);
      console.log(`✓ User found: ${user.email || 'no email'}`);
      
      if (user.email !== ADMIN_EMAIL) {
        console.warn(`⚠️  Warning: User email (${user.email}) does not match expected email (${ADMIN_EMAIL})`);
      }
    } catch (error) {
      console.error(`❌ User with UID ${ADMIN_UID} not found.`);
      console.error('Please verify the UID is correct.');
      process.exit(1);
    }
    
    // Set the admin custom claim
    await adminAuth.setCustomUserClaims(ADMIN_UID, { admin: true });
    console.log('✅ Admin claim set successfully!');
    
    // Verify the claim was set
    const user = await adminAuth.getUser(ADMIN_UID);
    console.log('Current custom claims:', user.customClaims);
    
    console.log('\n📝 Important:');
    console.log('The user must sign out and sign back in for the admin claim to take effect in their ID token.');
    console.log('After signing in again, the user will have admin: true in their token.');
    
  } catch (error) {
    console.error('❌ Error setting admin role:', error);
    process.exit(1);
  }
}

// Run the script
setAdminRole()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
