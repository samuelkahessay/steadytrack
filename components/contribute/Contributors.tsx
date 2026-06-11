export default function Contributors() {
  // List of contributors - easily expandable
  const contributors = [
    { name: "Samuel Kahessay", role: "Creator & Developer" },
    // Add more contributors here as they join
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Thank You to Our Contributors
          </h2>
          <p className="text-lg text-gray-600">
            This project is made possible by the dedication of these amazing people.
          </p>
        </div>

        {/* Contributors grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {contributors.map((contributor, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 text-center"
            >
              <p className="text-lg font-semibold text-gray-900">
                {contributor.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {contributor.role}
              </p>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Want to see your name here?{" "}
            <span className="font-semibold text-blue-600">
              Fill out the form above to get involved!
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
