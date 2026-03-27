// pool.end() is not called here because --runInBand runs suites sequentially
// and calling end() after each suite would break subsequent suites.
// Jest forceExit in jest.config.js handles process termination.
