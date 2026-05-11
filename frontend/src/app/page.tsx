import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold">Arogya Sathi</h1>
        <p className="opacity-80">Welcome. Please login to continue.</p>
        <Link className="underline" href="/login">Go to Login</Link>
      </div>
    </div>
  );
}
