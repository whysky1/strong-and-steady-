export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST krävs"});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY saknas i Vercel"});
  const food=String(req.body?.food||"").trim();
  if(!food || food.length>800) return res.status(400).json({error:"Skriv vad du åt"});

  const input=`Du är en svensk kolhydratuppskattare för mat.
Tolka naturligt vardagsspråk och hela måltider, t.ex. "en stor tallrik havregrynsgröt med mjölk och jordgubbssylt", "halv påse ostbågar" eller "8 bitar sushi".
Räkna ihop hela måltidens uppskattade kolhydrater. Om mängden är vag, gör en rimlig standarduppskattning och säg kort vad du antog.
Ge aldrig råd om insulin eller dosering.
Svara ENDAST med giltig JSON utan markdown:
{"carbs_g": number, "interpretation":"kort svensk sammanfattning av vad du räknade","note":"kort osäkerhetsnotis"}
Mat: ${food}`;

  try{
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({model:"gpt-5.6-luna",input})
    });
    const d=await r.json();
    if(!r.ok) return res.status(r.status).json({error:d?.error?.message||"OpenAI-anropet misslyckades"});

    const text=(d.output||[])
      .flatMap(x=>x.content||[])
      .filter(x=>x.type==="output_text")
      .map(x=>x.text)
      .join("")
      .trim();

    const clean=text.replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    const parsed=JSON.parse(clean);
    if(!Number.isFinite(Number(parsed.carbs_g))) throw new Error("Ogiltigt KH-värde");
    parsed.carbs_g=Math.round(Number(parsed.carbs_g)*10)/10;
    return res.status(200).json(parsed);
  }catch(e){
    return res.status(500).json({error:"AI-fel: "+e.message});
  }
}