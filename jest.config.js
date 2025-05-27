module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // Disable type checking for tests to speed them up.
      // Type checking should be handled by the TypeScript compiler (tsc) separately.
      isolatedModules: true,
    }],
  },
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json)
    // Example: '^@/(.*)$': '<rootDir>/src/$1'
    // Update this section based on your project's tsconfig.json "paths"
    '^@/(.*)$': '<rootDir>/$1'
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/"
  ],
  // globals: { // Keep this commented out unless specific ts-jest options are needed globally
  //   'ts-jest': {
  //     tsconfig: 'tsconfig.json' // or tsconfig.test.json if you have a specific one
  //   }
  // }
};
