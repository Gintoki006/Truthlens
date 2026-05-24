import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        resp = await client.post("http://localhost:8000/api/analyze", json={
            "text": "Chandrayaan-3 was a Japanese mission to the moon"
        }, timeout=45.0)
        print("Status code:", resp.status_code)
        print("Verdict:", resp.json().get("verdict"))
        print("Score:", resp.json().get("score"))
        
        # Optionally, we can also check Wikidata facts independently
        from services.wikidata_lookup import get_wikidata_facts
        facts = get_wikidata_facts("Chandrayaan-3")
        print("Facts from Wikidata:", list(facts.keys())[:5])

asyncio.run(test())
