/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // photo/PDF uploads on materials
    },
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dxijxdaczgjahrbqjzce.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4aWp4ZGFjemdqYWhyYnFqemNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NTY0MjAsImV4cCI6MjA5OTEzMjQyMH0.cSbaKJq7YQRz3zbY8L8Mckyngv-ORPgLXPQ0r57AioU",
  },
};
export default nextConfig;
