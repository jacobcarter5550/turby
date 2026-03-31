import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import ProviderProvider from "@/lib/ProviderProvider";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Turbine.site",
  description: "Wind turbine landing page",
  openGraph: {
    title: "Turbine.site",
    images: [{ url: "/ogImage.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Turbine.site",
    images: ["/ogImage.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body><ProviderProvider>{children}</ProviderProvider></body>
    </html>
  );
}
