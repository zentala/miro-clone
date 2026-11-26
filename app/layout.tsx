import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { ModalProvider } from "@/providers/modal-provider";

const inter = localFont({ src: "../public/fonts/inter-latin.woff2", variable: "--font-inter" });
const kalam = localFont({ src: "../public/fonts/kalam-latin.woff2", variable: "--font-kalam" });
const sourceSerif = localFont({ src: "../public/fonts/source-serif-4-latin.woff2", variable: "--font-source-serif" });
const jetbrains = localFont({ src: "../public/fonts/jetbrains-mono-latin.woff2", variable: "--font-jetbrains" });

export const metadata: Metadata = {
    title: "Miro Clone",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${kalam.variable} ${sourceSerif.variable} ${jetbrains.variable} ${inter.className}`}>

                    <Toaster />
                    <ModalProvider />
                    {children}

            </body>
        </html>
    );
}
