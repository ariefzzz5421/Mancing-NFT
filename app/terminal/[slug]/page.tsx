import {Terminal} from "@/components/terminal/Terminal";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <Terminal key={slug} slug={slug}/>}
