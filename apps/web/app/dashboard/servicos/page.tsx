import { redirect } from "next/navigation";

export default function ServicosPage() {
  redirect("/dashboard/configuracao?tab=servicos");
}
