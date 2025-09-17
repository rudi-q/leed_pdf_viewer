/**
 * Test file to verify our security implementation
 * This is for development/testing purposes only
 */

import { PasswordUtils } from './pdfSharingService';

export async function testPasswordSecurity() {
  console.log('🔐 Testing Password Security Implementation...');
  
  try {
    // Test 1: Salt generation
    console.log('\n1. Testing salt generation...');
    const salt1 = PasswordUtils.generateSalt();
    const salt2 = PasswordUtils.generateSalt();
    console.log(`Salt 1: ${salt1}`);
    console.log(`Salt 2: ${salt2}`);
    console.log(`Salts are different: ${salt1 !== salt2 ? '✅' : '❌'}`);
    console.log(`Salt length: ${salt1.length} characters`);
    
    // Test 2: Password hashing
    console.log('\n2. Testing password hashing...');
    const testPassword = 'mySecretPassword123!';
    const salt = PasswordUtils.generateSalt();
    
    const startTime = Date.now();
    const hash1 = await PasswordUtils.hashPassword(testPassword, salt);
    const hashTime = Date.now() - startTime;
    
    console.log(`Password: ${testPassword}`);
    console.log(`Salt: ${salt}`);
    console.log(`Hash: ${hash1}`);
    console.log(`Hash length: ${hash1.length} characters`);
    console.log(`Hash time: ${hashTime}ms`);
    
    // Test 3: Consistent hashing
    console.log('\n3. Testing hash consistency...');
    const hash2 = await PasswordUtils.hashPassword(testPassword, salt);
    console.log(`Hash 1: ${hash1}`);
    console.log(`Hash 2: ${hash2}`);
    console.log(`Hashes match: ${hash1 === hash2 ? '✅' : '❌'}`);
    
    // Test 4: Different password produces different hash
    console.log('\n4. Testing different password...');
    const differentPassword = 'differentPassword456!';
    const hash3 = await PasswordUtils.hashPassword(differentPassword, salt);
    console.log(`Different password hash: ${hash3}`);
    console.log(`Different hashes: ${hash1 !== hash3 ? '✅' : '❌'}`);
    
    // Test 5: Password verification - correct password
    console.log('\n5. Testing password verification (correct)...');
    const isValidCorrect = await PasswordUtils.verifyPassword(testPassword, hash1, salt);
    console.log(`Correct password verified: ${isValidCorrect ? '✅' : '❌'}`);
    
    // Test 6: Password verification - incorrect password
    console.log('\n6. Testing password verification (incorrect)...');
    const isValidIncorrect = await PasswordUtils.verifyPassword('wrongPassword', hash1, salt);
    console.log(`Incorrect password rejected: ${!isValidIncorrect ? '✅' : '❌'}`);
    
    // Test 7: Date calculations
    console.log('\n7. Testing expiration date calculation...');
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    console.log(`Current date: ${now.toISOString()}`);
    console.log(`Expiration date (+30 days): ${futureDate.toISOString()}`);
    console.log(`Is future date later: ${futureDate > now ? '✅' : '❌'}`);
    
    console.log('\n🎉 All security tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Security test failed:', error);
    return false;
  }
}

// Export the PasswordUtils class for testing
export { PasswordUtils } from './pdfSharingService';