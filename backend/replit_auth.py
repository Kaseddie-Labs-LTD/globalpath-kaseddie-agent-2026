"""
Replit Auth — OIDC integration for FastAPI
Uses PKCE + signed session cookies (itsdangerous) + PyJWT for token decoding.
"""
import os
import hashlib
import base64
import secrets
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

ISSUER_URL = os.environ.get("ISSUER_URL", "https://replit.com/oidc")
REPL_ID = os.environ.get("REPL_ID", "")
SESSION_SECRET = os.environ.get("SESSION_SECRET", os.environ.get("JWT_SECRET", ""))
SESSION_COOKIE = "gp_session"
SESSION_MAX_AGE = 7 * 24 * 60 * 60  # 1 week


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(SESSION_SECRET, salt="gp-auth-session")


def _pkce_pair():
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def set_session(response: Response, user: dict) -> None:
    signed = _signer().dumps(user)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=signed,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
    )


def get_session(request: Request) -> Optional[dict]:
    cookie = request.cookies.get(SESSION_COOKIE)
    if not cookie:
        return None
    try:
        return _signer().loads(cookie, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def clear_session(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


def _callback_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    scheme = request.headers.get("x-forwarded-proto", "https")
    return f"{scheme}://{host}/api/auth/callback"


async def login_redirect(request: Request) -> RedirectResponse:
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(16)

    # Store verifier + state in a short-lived plain cookie (not sensitive)
    pkce_payload = json.dumps({"verifier": verifier, "state": state})
    pkce_signed = _signer().dumps(pkce_payload)

    import urllib.parse
    params = urllib.parse.urlencode({
        "client_id": REPL_ID,
        "redirect_uri": _callback_url(request),
        "response_type": "code",
        "scope": "openid email profile offline_access",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "prompt": "login consent",
    })
    auth_url = f"{ISSUER_URL}/auth?{params}"

    response = RedirectResponse(url=auth_url, status_code=302)
    response.set_cookie(
        key="gp_pkce",
        value=pkce_signed,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return response


async def auth_callback(request: Request) -> Response:
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    pkce_cookie = request.cookies.get("gp_pkce")
    if not pkce_cookie or not code:
        return RedirectResponse(url="/", status_code=302)

    try:
        pkce_payload = json.loads(_signer().loads(pkce_cookie, max_age=600))
    except Exception:
        return RedirectResponse(url="/", status_code=302)

    if pkce_payload.get("state") != state:
        return RedirectResponse(url="/", status_code=302)

    verifier = pkce_payload["verifier"]
    callback_url = _callback_url(request)

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"{ISSUER_URL}/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": callback_url,
                "client_id": REPL_ID,
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )

    if token_resp.status_code != 200:
        print(f"❌ [REPLIT AUTH] Token exchange failed: {token_resp.text}")
        return RedirectResponse(url="/", status_code=302)

    tokens = token_resp.json()
    id_token = tokens.get("id_token", "")

    claims = jwt.decode(id_token, options={"verify_signature": False})

    user = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "first_name": claims.get("first_name"),
        "last_name": claims.get("last_name"),
        "profile_image_url": claims.get("profile_image_url"),
        "expires_at": claims.get("exp"),
        "access_token": tokens.get("access_token"),
    }

    redirect_response = RedirectResponse(url="/", status_code=302)
    redirect_response.delete_cookie("gp_pkce")
    set_session(redirect_response, user)
    print(f"✅ [REPLIT AUTH] User logged in: {user.get('email') or user.get('sub')}")
    return redirect_response


async def auth_logout(request: Request) -> RedirectResponse:
    import urllib.parse
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    scheme = request.headers.get("x-forwarded-proto", "https")
    post_logout = f"{scheme}://{host}/"

    params = urllib.parse.urlencode({
        "client_id": REPL_ID,
        "post_logout_redirect_uri": post_logout,
    })
    logout_url = f"{ISSUER_URL}/session/end?{params}"

    response = RedirectResponse(url=logout_url, status_code=302)
    clear_session(response)
    print("✅ [REPLIT AUTH] User logged out")
    return response


async def auth_user(request: Request) -> Response:
    user = get_session(request)
    if not user:
        return JSONResponse(status_code=401, content={"message": "Not authenticated"})
    return JSONResponse(content={
        "sub": user.get("sub"),
        "email": user.get("email"),
        "firstName": user.get("first_name"),
        "lastName": user.get("last_name"),
        "profileImageUrl": user.get("profile_image_url"),
    })
