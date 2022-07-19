MAKEFLAGS 		:= --jobs=$(shell nproc) --warn-undefined-variables
PROJECT_NAME 	:= Pulumi dynamic resource provider and SDK for NodeJS

VERSION         := $(shell pulumictl get version)
TESTPARALLELISM := 10

PACK            := nodejs-dynamic
PROVIDER        := pulumi-resource-${PACK}
GZIP_PREFIX		:= pulumi-resource-${PACK}-v${VERSION}
BIN				:= ${PROVIDER}

PROVIDER_SRC 	:= $(wildcard cmd/*.*) $(wildcard cmd/*/*.ts)
SDK_SRC 		:= $(wildcard sdk/*.*) $(wildcard sdk/*/*.ts)

WORKING_DIR     := $(shell pwd)

GOPATH 		 	?= ${HOME}/go
GOBIN  		 	?= ${GOPATH}/bin
LOCAL_PLAT		?= ""

PKG_ARGS 		:= --no-bytecode --public-packages "*" --public

all:: lint provider build_sdk test_provider

cmd/node_modules: cmd/package.json cmd/yarn.lock sdk/bin
	yarn install --cwd cmd --no-progress
	@touch cmd/node_modules

cmd/bin: cmd/node_modules ${PROVIDER_SRC}
	@cd cmd && \
		yarn tsc && \
		cp package.json ./bin/ && \
		sed -i.bak -e "s/\$${VERSION}/$(VERSION)/g" ./bin/package.json

# Re-use the local platform if provided (e.g. `make provider LOCAL_PLAT=linux-amd64`)
ifneq ($(LOCAL_PLAT),"")
bin/${PROVIDER}:: bin/provider/$(LOCAL_PLAT)/${PROVIDER}
	cp bin/provider/$(LOCAL_PLAT)/${PROVIDER} bin/${PROVIDER}
else
bin/${PROVIDER}: cmd/bin cmd/node_modules
	cd cmd && yarn run pkg . ${PKG_ARGS} --target node16 --output $(WORKING_DIR)/bin/${PROVIDER}
endif

bin/provider/linux-amd64/${PROVIDER}:: TARGET := node16-linuxstatic-x64
bin/provider/linux-arm64/${PROVIDER}:: TARGET := node16-linuxstatic-arm64
bin/provider/darwin-amd64/${PROVIDER}:: TARGET := node16-macos-x64
bin/provider/darwin-arm64/${PROVIDER}:: TARGET := node16-macos-arm64
bin/provider/windows-amd64/${PROVIDER}.exe:: TARGET := node16-win-x64
bin/provider/%:: cmd/bin cmd/node_modules
	test ${TARGET}
	cd cmd && \
		yarn run pkg . ${PKG_ARGS} --target ${TARGET} --output ${WORKING_DIR}/$@

dist/${GZIP_PREFIX}-linux-amd64.tar.gz:: bin/provider/linux-amd64/${PROVIDER}
dist/${GZIP_PREFIX}-linux-arm64.tar.gz:: bin/provider/linux-arm64/${PROVIDER}
dist/${GZIP_PREFIX}-darwin-amd64.tar.gz:: bin/provider/darwin-amd64/${PROVIDER}
dist/${GZIP_PREFIX}-darwin-arm64.tar.gz:: bin/provider/darwin-arm64/${PROVIDER}
dist/${GZIP_PREFIX}-windows-amd64.tar.gz:: bin/provider/windows-amd64/${PROVIDER}.exe

dist/${GZIP_PREFIX}-%.tar.gz::
	@mkdir -p dist
	@# $< is the last dependency (the binary path from above)
	tar --gzip -cf $@ README.md LICENSE -C $$(dirname $<) .

sdk/node_modules: sdk/package.json sdk/yarn.lock
	yarn install --cwd sdk --no-progress
	@touch sdk/node_modules

sdk/bin: VERSION := $(shell pulumictl get version --language javascript)
sdk/bin: sdk/node_modules ${SDK_SRC}
	cd sdk && \
		yarn run tsc && \
		sed -e 's/\$${VERSION}/$(VERSION)/g' < package.json > bin/package.json && \
		cp ../README.md ../LICENSE bin/

# Phony targets

build_provider: cmd/bin

build_sdk: sdk/bin

install_provider: bin/${PROVIDER}
	rm -f ${GOBIN}/${PROVIDER}
	cp bin/${PROVIDER} ${GOBIN}/${PROVIDER}

install_sdk: sdk/bin
	yarn link --cwd $(WORKING_DIR)/sdk/bin

lint_provider: cmd/node_modules
	cd cmd && \
		yarn format && yarn lint

lint_sdk: sdk/node_modules
	cd sdk && \
		yarn format && yarn lint

lint: lint_provider lint_sdk

test_provider: cmd/node_modules
	cd cmd && yarn test

istanbul_tests:
	cd cmd/tests && \
		yarn && yarn run build && yarn run mocha $$(find bin -name '*.spec.js')

test_sdk: PATH := $(WORKING_DIR)/bin:$(PATH)
test_sdk: bin/${PROVIDER} install_sdk
	@export PATH
	cd examples && go test -tags=nodejs -v -json -count=1 -cover -timeout 3h -parallel ${TESTPARALLELISM} . 2>&1 | tee /tmp/gotest.log | gotestfmt

test: PATH := $(WORKING_DIR)/bin:$(PATH)
test:
	@export PATH
	@if [ -z "${Test}" ]; then \
		cd examples && go test -v -json -count=1 -cover -timeout 3h -parallel ${TESTPARALLELISM} . 2>&1 | tee /tmp/gotest.log | gotestfmt; \
	else \
		cd examples && go test -v -json -count=1 -cover -timeout 3h . --run=${Test} 2>&1 | tee /tmp/gotest.log; \
	fi

provider: bin/${PROVIDER}
dist:: dist/${GZIP_PREFIX}-linux-amd64.tar.gz
dist:: dist/${GZIP_PREFIX}-linux-arm64.tar.gz
dist:: dist/${GZIP_PREFIX}-darwin-amd64.tar.gz
dist:: dist/${GZIP_PREFIX}-darwin-arm64.tar.gz
dist:: dist/${GZIP_PREFIX}-windows-amd64.tar.gz

clean:
	rm -rf bin dist cmd/bin cmd/node_modules sdk/node_modules

build: provider test_provider build_sdk

dev: lint test_provider build_sdk

.PHONY: clean provider install_sdk install_provider dist build dev test test_sdk istanbul_tests test_provider lint lint_sdk lint_provider
