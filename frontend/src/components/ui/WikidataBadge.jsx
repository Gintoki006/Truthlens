"use client"

export default function WikidataBadge({ status }) {
  if (!status || status === "unverified") return null;

  const isConfirmed = status === "confirmed";
  
  return (
    <div className={`mt-2 border rounded-md p-2 text-xs flex items-center gap-2 shadow-sm ${
      isConfirmed ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-red-50 border-red-200 text-red-800"
    }`}>
      <span className={`font-bold ${isConfirmed ? 'text-blue-600' : 'text-red-600'}`}>W</span>
      <span className="font-medium">
        {isConfirmed ? "Entity predicates confirmed via Wikidata" : "Entity predicates contradicted by Wikidata"}
      </span>
    </div>
  )
}
