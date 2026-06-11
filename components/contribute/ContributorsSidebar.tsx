export default function ContributorsSidebar() {
  const contributors = [
    { name: "Alex Kahessay", role: "User Experience Testing" },
    { name: "Atharva Roy", role: "User Experience Testing" },
    { name: "Bishesh Khanal", role: "User Experience Testing" },
  ];

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
      <h3 className="text-base font-semibold text-white mb-3">
        Special Thanks To Our Contributors
      </h3>
      <div className="space-y-3">
        {contributors.map((contributor, index) => (
          <div key={index} className="flex flex-col gap-1">
            <p className="text-white font-medium text-sm">
              {contributor.name}
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-blue-100 w-fit">
              {contributor.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
