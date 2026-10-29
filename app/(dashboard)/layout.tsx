export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <main className="h-full bg-white"><div className="h-full p-5">{children}</div></main>;
}
