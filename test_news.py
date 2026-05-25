import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def test():
    api_key = os.getenv("NEWS_API_KEY")
    url = "https://newsapi.org/v2/top-headlines"
    params = {
        "country": "us",
        "category": "general",
        "pageSize": 2,
        "apiKey": api_key,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        print("STATUS:", response.status_code)
        print("BODY:", response.text)

if __name__ == "__main__":
    asyncio.run(test())
