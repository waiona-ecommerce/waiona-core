#!/usr/bin/env node
'use strict';
// Wrapper para TypeORM CLI — registra ts-node + tsconfig-paths antes de invocar la CLI
require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
require('typeorm/cli');
