ENV ?= development
PROFILE ?= stack
COMPOSE_BASE := compose/base.yml
COMPOSE_ENV := compose/$(ENV).yml
COMPOSE := docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_ENV)

COMMON_ENV_FILE ?= env/common.env
DEVELOPMENT_ENV_DIR ?= env/development
PRODUCTION_ENV_DIR ?= env/production

export COMMON_ENV_FILE
export DEVELOPMENT_ENV_DIR
export PRODUCTION_ENV_DIR

.PHONY: up up-detached down ps logs build

up:
	$(COMPOSE) --profile $(PROFILE) up

up-detached:
	$(COMPOSE) --profile $(PROFILE) up -d

build:
	$(COMPOSE) --profile $(PROFILE) build

ps:
	$(COMPOSE) --profile $(PROFILE) ps

logs:
	$(COMPOSE) --profile $(PROFILE) logs

down:
	$(COMPOSE) --profile $(PROFILE) down
