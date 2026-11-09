import { business } from "@/config/business";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-semibold">{business.name}</h1>
    </main>
  );
}
