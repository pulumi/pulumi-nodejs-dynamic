package examples

import (
	"os"
	"testing"

	"github.com/pulumi/pulumi/pkg/v3/testing/integration"
)

func getCwd(t *testing.T) string {
	cwd, err := os.Getwd()
	if err != nil {
		t.FailNow()
	}

	return cwd
}

func getBaseOptions(t *testing.T) integration.ProgramTestOptions {
	baseJS := integration.ProgramTestOptions{
		Quick:                true,
		SkipRefresh:          true,
		ExpectRefreshChanges: true,
	}

	return baseJS
}
