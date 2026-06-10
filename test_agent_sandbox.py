import os
import unittest
from unittest.mock import MagicMock
from utils.db_sync_pipeline import ReadOnlyCollectionWrapper, get_mongo_collection


class TestOversightSentinelSandbox(unittest.TestCase):

    def setUp(self):
        # Configure local environment simulation variables
        os.environ["AGENT_READ_ONLY"] = "true"
        os.environ["ALLOW_DB_WRITES"] = "false"
        
        # Build a decoupled mock collection to prevent hitting live cluster sockets during test
        self.mock_raw_collection = MagicMock()
        self.sandbox_wrapper = ReadOnlyCollectionWrapper(self.mock_raw_collection)

    def test_read_operations_allowed(self):
        """
        Verify that read operations bypass the wrapper smoothly to support agent reasoning.
        """
        # Simulate standard MongoDB lookup operations used by your Gemini tools
        self.mock_raw_collection.find_one.return_value = {"company": "Test Node", "status": "FLAGGED"}
        
        try:
            result = self.sandbox_wrapper.find_one({"company": "Test Node"})
            self.assertEqual(result["status"], "FLAGGED")
            self.mock_raw_collection.find_one.assert_called_once_with({"company": "Test Node"})
            print("✅ Read Validation Pass: Lookup queries execute seamlessly through the wrapper.")
        except Exception as e:
            self.fail(f"Read-only lookup was unexpectedly blocked: {str(e)}")

    def test_write_operations_explicitly_blocked(self):
        """
        Verify that any mutating operations immediately trigger a security exception.
        """
        # Attempt an unauthorized write operation simulating an unstable agent payload state
        with self.assertRaises(RuntimeError) as context:
            self.sandbox_wrapper.insert_one({"violator": "Bad Actor Inc", "fee_charged": 2500})
            
        self.assertIn("Security Violation: Mutating method 'insert_one' called", str(context.exception))
        # Ensure the underlying real database driver handle was never touched
        self.mock_raw_collection.insert_one.assert_not_called()
        print("🔒 Write Restriction Pass: In-process safety net caught and blocked mutating action successfully.")

if __name__ == "__main__":
    print("Executing Oversight Sentinel Sandbox Structural Integrity Tests...")
    unittest.main()
