import html
import json
import re
import sys
import urllib.request

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._]{1,30}$")
DEFAULT_TIMEOUT_SECONDS = 8


def build_error(code, message, status_code=500):
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "statusCode": status_code,
        },
    }


def normalize_username(raw):
    return str(raw or "").strip().lstrip("@").lower()


def validate_username(username):
    if not username or not USERNAME_PATTERN.match(username) or ".." in username:
        return False
    return True


def parse_metric_value(raw):
    if not raw:
        return 0
    normalized = str(raw).strip().lower().replace(",", "")
    match = re.match(r"(\d+(?:\.\d+)?)([km])?", normalized)
    if not match:
        try:
            return int(normalized)
        except ValueError:
            return 0
    base = float(match.group(1))
    suffix = match.group(2)
    if suffix == "k":
        return round(base * 1000)
    if suffix == "m":
        return round(base * 1000000)
    return round(base)


def extract_meta_content(html, prop):
    pattern = re.compile(r"<meta[^>]+property=['\"]%s['\"][^>]+content=['\"]([^'\"]+)['\"]" % re.escape(prop), re.IGNORECASE)
    match = pattern.search(html)
    return html_unescape(match.group(1)) if match else ""


def html_unescape(value):
    return html.unescape(value or "")


def extract_name_and_handle(og_title, username):
    if not og_title:
        return username, username
    match = re.match(r"^(.*?)\s*\(@([^\)]+)\)", og_title)
    if not match:
        return og_title.strip(), username
    name = match.group(1).strip() or username
    handle = match.group(2).strip() or username
    return name, handle


def extract_counts(og_description):
    if not og_description:
        return 0, 0, 0, False
    followers = re.search(r"([\d.,]+\s*[km]?)\s*Followers", og_description, re.IGNORECASE)
    following = re.search(r"([\d.,]+\s*[km]?)\s*Following", og_description, re.IGNORECASE)
    posts = re.search(r"([\d.,]+\s*[km]?)\s*Posts", og_description, re.IGNORECASE)
    has_tokens = re.search(r"Followers", og_description, re.IGNORECASE) and re.search(r"Posts", og_description, re.IGNORECASE)
    return (
        parse_metric_value(followers.group(1)) if followers else 0,
        parse_metric_value(following.group(1)) if following else 0,
        parse_metric_value(posts.group(1)) if posts else 0,
        bool(has_tokens),
    )


def is_private_profile(html, og_description="", og_title=""):
    return (
        re.search(r"this account is private|private account|\"is_private\"\s*:\s*true", html, re.IGNORECASE)
        or re.search(r"this account is private", og_description, re.IGNORECASE)
        or re.search(r"follow this account to see their photos and videos", og_description, re.IGNORECASE)
        or re.search(r"private", og_title, re.IGNORECASE)
    ) is not None


def fetch_public_profile(username):
    url = "https://www.instagram.com/%s/" % username
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; CreatorOS/1.0; +https://creatoros.local)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            status = response.getcode()
            html = response.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        status = exc.code
        if status == 404:
            return build_error("PROFILE_NOT_FOUND", "Instagram profile not found.", 404)
        if status == 429:
            return build_error("RATE_LIMITED", "Instagram is rate limiting public profile requests. Please try again later.", 429)
        return build_error("TEMPORARY_FETCH_ERROR", "Instagram profile could not be fetched right now. Please try again later.", status)
    except Exception:
        return build_error("TEMPORARY_FETCH_ERROR", "Unable to fetch Instagram profile right now. Please try again later.", 500)

    if status != 200:
        return build_error("TEMPORARY_FETCH_ERROR", "Instagram profile could not be fetched right now. Please try again later.", status)

    og_title = extract_meta_content(html, "og:title")
    og_description = extract_meta_content(html, "og:description")
    og_image = extract_meta_content(html, "og:image")
    if is_private_profile(html, og_description, og_title):
        return build_error("PRIVATE_PROFILE_UNSUPPORTED", "This Instagram profile is private and cannot be fetched without authorized access.", 403)
    name, handle = extract_name_and_handle(og_title, username)
    followers, following, total_posts, has_count_tokens = extract_counts(og_description)
    if not has_count_tokens:
        return build_error("PRIVATE_PROFILE_UNSUPPORTED", "This Instagram profile is private and cannot be fetched without authorized access.", 403)

    return {
        "success": True,
        "data": {
            "username": handle or username,
            "name": name or username,
            "profileImage": og_image or "",
            "bio": og_description or "",
            "followers": followers,
            "following": following,
            "totalPosts": total_posts,
        },
    }


def main():
    username = normalize_username(sys.argv[1] if len(sys.argv) > 1 else "")
    if not validate_username(username):
        print(json.dumps(build_error("INVALID_USERNAME", "Enter a valid Instagram username using letters, numbers, periods, or underscores.", 400)))
        return

    payload = fetch_public_profile(username)
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
