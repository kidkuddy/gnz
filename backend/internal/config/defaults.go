package config

func NewDefault() *Config {
	return &Config{
		Port:    0,
		DataDir: defaultDataDir(),
		SupportedDatabases: []string{
			"postgres",
			"mysql",
			"sqlite",
		},
		SupportedOutputs: []string{
			"json",
			"markdown",
		},
		Features: FeatureFlags{
			DB:        true,
			MCP:       true,
			Logs:      false,
			Dashboard: false,
			SQLEditor: true,
			Claude:    true,
		},
	}
}
