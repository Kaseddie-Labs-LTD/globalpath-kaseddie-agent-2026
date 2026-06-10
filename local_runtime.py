import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Force search for .env in both the repository root and backend folder.
root_env = Path(__file__).resolve().parent / '.env'
backend_env = Path(__file__).resolve().parent / 'backend' / '.env'
print(f"Attempting to load .env from root: {root_env}")
load_dotenv(dotenv_path=root_env, override=True)
print(f"Attempting to load .env from backend: {backend_env}")
load_dotenv(dotenv_path=backend_env, override=True)

# 🛑 STAGE 1: CONDITIONAL ISOLATION OF ENVIRONMENT BEFORE ANY IMPORTS
# By default do NOT purge Google-related env vars so the runtime can bind
# to the active process environment. Set FORCE_ISOLATE=true to enable
# legacy isolation behavior.
if os.getenv("FORCE_ISOLATE", "false").lower() == "true":
    os.environ.pop("GOOGLE_API_KEY", None)
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)
    os.environ.pop("VERTEXAI_PROJECT", None)
    os.environ.pop("VERTEXAI_LOCATION", None)
    os.environ.pop("GOOGLE_CLOUD_PROJECT", None)
    os.environ.pop("GOOGLE_CLOUD_REGION", None)

# Require Gemini API key from environment; do not hardcode secrets in code
if "GEMINI_API_KEY" not in os.environ and "VITE_APP_GEMINI_API_KEY" not in os.environ:
    print("❌ GEMINI_API_KEY not found in environment. Set GEMINI_API_KEY securely.")
    sys.exit(1)
# Accept VITE variable as alias for local developer workflows
if "VITE_APP_GEMINI_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["VITE_APP_GEMINI_API_KEY"]
if "GEMINI_API_KEY" in os.environ and "GENAI_API_KEY" not in os.environ:
    os.environ["GENAI_API_KEY"] = os.environ["GEMINI_API_KEY"]

# 🛠️ FORCE PHYSICAL PATH RESOLUTION FOR IMPORT SEARCHING
# This forces Python to look directly inside the directory where this script runs
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
os.chdir(current_dir)

# 🚀 STAGE 2: IMPORT ADK AND AGENT
import asyncio
from google.adk.runners import InMemoryRunner
from google.genai import types
from google.genai.errors import ClientError
from google.adk.models.google_llm import _ResourceExhaustedError

try:
    from my_agent_setup import root_agent
except ImportError as e:
    print(f"❌ Critical Error: Could not locate 'my_agent_setup.py' in workspace. Details: {e}")
    sys.exit(1)

async def run_local_agent_communication():
    print("⚡ [ADK Runtime] Re-initializing direct Developer Tier channel...")

    runner = InMemoryRunner(agent=root_agent)

    # Extract Memory Session Service
    session_service = None
    for attr_name in dir(runner):
        attr = getattr(runner, attr_name, None)
        if attr.__class__.__name__ == "InMemorySessionService":
            session_service = attr
            break
    if not session_service and hasattr(runner, "node"):
        node = getattr(runner, "node")
        for attr_name in dir(node):
            attr = getattr(node, attr_name, None)
            if attr.__class__.__name__ == "InMemorySessionService":
                session_service = attr
                break

    resolved_app_name = getattr(runner, "app_name", "InMemoryRunner")
    user_id = "kaseddie_user"
    session_id = "local_diagnostic_session"

    if session_service:
        print(f"🗲 [Session Registry] Synchronizing session state '{session_id}'...")
        try:
            await session_service.create_session(
                app_name=resolved_app_name, user_id=user_id, session_id=session_id
            )
        except Exception:
            pass

    print("🟢 [Local Stream Connected] Workspace isolated from restricted cloud billing.")
    print("-" * 60)

    test_prompt = (
        "Search the application's database and return the 10 most recent documents "
        "from the 'documents' collection. For each record include: Mongo _id, created_at, "
        "metadata title (if present), metadata location (if present), and a one-line "
        "summary of the text field. Present results in JSON array form."
    )
    print(f"👤 User: {test_prompt}\n")
    print("🤖 Root Agent Response: ", end="", flush=True)

    new_message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=test_prompt)]
    )

    # Persistent runner loop: on resource exhaustion back off and retry indefinitely
    while True:
        try:
            async for event in runner.run_async(
                user_id=user_id, session_id=session_id, new_message=new_message
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            print(part.text, end="", flush=True)
            # Successful run; exit loop
            break
        except _ResourceExhaustedError as e:
            # Extended cooldown window to clear rate-limit windows
            print("\n⚠️ Free-tier quota hit. Cooling down for 60 seconds to clear RPM window...")
            await asyncio.sleep(60)
            continue
        except ClientError as e:
            # Non-rate-limit client errors are considered fatal here
            print(f"\n❌ Framework ClientError: {e}")
            break
        except Exception as e:
            print(f"\n❌ Framework Runtime Error: {e}")
            break

    print("\n" + "-" * 60)

if __name__ == "__main__":
    asyncio.run(run_local_agent_communication())