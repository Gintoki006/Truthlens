"""
Source credibility signal (weight: 35% of final score).

Looks up the domain in the Supabase `source` table and applies penalties
for HTTP-only, young domains, and unknown authors.
"""

import os
import ssl
import socket
from datetime import datetime, timezone

from supabase import create_client

_supabase = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        _supabase = create_client(url, key)
    return _supabase


def _check_https(domain: str) -> bool:
    """Check if domain supports HTTPS."""
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=3):
            return True
    except Exception:
        return False


def _check_domain_age(domain: str) -> int | None:
    """
    Check domain age in months using python-whois.
    Returns None if WHOIS lookup fails.
    """
    try:
        import whois

        w = whois.whois(domain)
        creation_date = w.creation_date
        if isinstance(creation_date, list):
            creation_date = creation_date[0]
        if creation_date is None:
            return None
        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - creation_date).days
        return age_days // 30  # approximate months
    except Exception:
        return None


def compute_source_score(domain: str, authors: list[str] | None = None) -> dict:
    """
    Compute the source credibility score for a given domain.

    Returns:
        dict with keys: score, trust_score, category, bias, is_known,
                        https_ok, domain_age_months, penalties
    """
    if not domain:
        return {
            "score": 50,
            "trust_score": 50,
            "category": None,
            "bias": "unknown",
            "is_known": False,
            "https_ok": True,
            "domain_age_months": None,
            "penalties": [],
        }

    # Lookup in Supabase source table
    supabase = _get_supabase()
    result = supabase.table("source").select("*").eq("domain", domain).execute()

    penalties = []
    if result.data and len(result.data) > 0:
        row = result.data[0]
        trust_score = row.get("trust_score", 50)
        category = row.get("category")
        bias = row.get("bias", "unknown")
        is_known = True
    else:
        trust_score = 50
        category = None
        bias = "unknown"
        is_known = False

    # Penalty: HTTP-only domain (-10)
    https_ok = _check_https(domain)
    if not https_ok:
        trust_score -= 10
        penalties.append("HTTP-only domain (-10)")

    # Penalty: Young domain < 6 months (-15)
    domain_age = _check_domain_age(domain)
    if domain_age is not None and domain_age < 6:
        trust_score -= 15
        penalties.append(f"Domain age {domain_age} months (-15)")

    # Penalty: Unknown/no authors (-5)
    if not authors or len(authors) == 0:
        trust_score -= 5
        penalties.append("No author identified (-5)")

    # Clamp to 0-100
    trust_score = max(0, min(100, trust_score))

    return {
        "score": trust_score,
        "trust_score": trust_score,
        "category": category,
        "bias": bias,
        "is_known": is_known,
        "https_ok": https_ok,
        "domain_age_months": domain_age,
        "penalties": penalties,
    }
