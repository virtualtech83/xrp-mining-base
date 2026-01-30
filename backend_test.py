import requests
import sys
import json
from datetime import datetime

class XRPMiningAPITester:
    def __init__(self, base_url="https://virtual-xrp-miner.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "referral_code": None
            },
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Registered user: {test_email}")
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.user_id:
            return False
            
        # Try to login with the registered user
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!"
            },
            auth_required=False
        )
        return success

    def test_get_profile(self):
        """Test getting user profile"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "user/profile",
            200
        )
        return success

    def test_start_mining(self):
        """Test starting a mining session"""
        success, response = self.run_test(
            "Start Mining Session",
            "POST",
            "mining/start",
            200,
            data={}
        )
        if success and 'id' in response:
            self.session_id = response['id']
            print(f"   Started session: {self.session_id}")
        return success

    def test_get_active_session(self):
        """Test getting active mining session"""
        success, response = self.run_test(
            "Get Active Mining Session",
            "GET",
            "mining/active",
            200
        )
        return success

    def test_stop_mining(self):
        """Test stopping a mining session"""
        if not self.session_id:
            print("❌ No active session to stop")
            return False
            
        success, response = self.run_test(
            "Stop Mining Session",
            "POST",
            "mining/stop",
            200,
            data={
                "session_id": self.session_id,
                "duration_minutes": 2.5
            }
        )
        return success

    def test_mining_history(self):
        """Test getting mining history"""
        success, response = self.run_test(
            "Get Mining History",
            "GET",
            "mining/history",
            200
        )
        return success

    def test_daily_reward_status(self):
        """Test checking daily reward status"""
        success, response = self.run_test(
            "Check Daily Reward Status",
            "GET",
            "rewards/daily/status",
            200
        )
        return success

    def test_claim_daily_reward(self):
        """Test claiming daily reward"""
        success, response = self.run_test(
            "Claim Daily Reward",
            "POST",
            "rewards/daily",
            200,
            data={}
        )
        return success

    def test_referral_stats(self):
        """Test getting referral statistics"""
        success, response = self.run_test(
            "Get Referral Stats",
            "GET",
            "referral/stats",
            200
        )
        return success

    def test_withdrawal_request(self):
        """Test requesting a withdrawal"""
        success, response = self.run_test(
            "Request Withdrawal",
            "POST",
            "withdrawal/request",
            200,
            data={"amount": 1.0}
        )
        return success

    def test_withdrawal_history(self):
        """Test getting withdrawal history"""
        success, response = self.run_test(
            "Get Withdrawal History",
            "GET",
            "withdrawal/history",
            200
        )
        return success

    def test_leaderboard(self):
        """Test getting leaderboard"""
        success, response = self.run_test(
            "Get Leaderboard",
            "GET",
            "leaderboard",
            200,
            auth_required=False
        )
        return success

    def test_invalid_token(self):
        """Test API with invalid token"""
        original_token = self.token
        self.token = "invalid_token_123"
        
        success, response = self.run_test(
            "Invalid Token Test",
            "GET",
            "user/profile",
            401
        )
        
        self.token = original_token
        # For this test, we expect failure (401), so success means the test passed
        return not success  # Invert because we expect 401

def main():
    print("🚀 Starting XRP Mining API Tests...")
    print("=" * 50)
    
    tester = XRPMiningAPITester()
    
    # Test sequence
    tests = [
        ("User Registration", tester.test_user_registration),
        ("Get User Profile", tester.test_get_profile),
        ("Daily Reward Status", tester.test_daily_reward_status),
        ("Claim Daily Reward", tester.test_claim_daily_reward),
        ("Start Mining", tester.test_start_mining),
        ("Get Active Session", tester.test_get_active_session),
        ("Stop Mining", tester.test_stop_mining),
        ("Mining History", tester.test_mining_history),
        ("Referral Stats", tester.test_referral_stats),
        ("Withdrawal Request", tester.test_withdrawal_request),
        ("Withdrawal History", tester.test_withdrawal_history),
        ("Leaderboard", tester.test_leaderboard),
        ("Invalid Token", tester.test_invalid_token)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    print("\n🏁 Testing completed!")
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())