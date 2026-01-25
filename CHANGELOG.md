# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.3.1](https://github.com/luukderooij/Darts/compare/v1.3.0...v1.3.1) (2026-01-25)

## [1.3.0](https://github.com/luukderooij/Darts/compare/v1.1.0...v1.3.0) (2026-01-25)


### Features

* add .dockerignore to exclude unnecessary files and directories from Docker context ([838e01d](https://github.com/luukderooij/Darts/commit/838e01d234a6f98bf7835a8318a19ced8b10e9f7))
* add Home page component and set it as the default route ([0be9685](https://github.com/luukderooij/Darts/commit/0be9685a508e795a4e9ce51e5e3e678fc4051b81))
* add ScorerMenu component and implement poule filtering in MatchList ([a1264d1](https://github.com/luukderooij/Darts/commit/a1264d17ed6ec30f2137c3486995aa7b9d397aa4))
* add tournament deletion endpoint and implement delete functionality in Dashboard and MatchList ([328078a](https://github.com/luukderooij/Darts/commit/328078a8469922574bdb752986fa3fdd63278012))
* implement response interceptor for API to handle unauthorized errors and redirect to login ([67c1605](https://github.com/luukderooij/Darts/commit/67c1605ef918506fd521f6086f9cc44b7b3fbc1f))
* make layout mobile responsive and update home links ([820efd4](https://github.com/luukderooij/Darts/commit/820efd4d95e6b4dfb6a6236876306add81979e90))
* refactor AuthContext to import User type and streamline authentication logic ([3c4068e](https://github.com/luukderooij/Darts/commit/3c4068e2a600fff81badc40e26f923db1b60768b))
* update README with additional Docker commands for container management ([8a0e764](https://github.com/luukderooij/Darts/commit/8a0e7648636ddcb01403845f841b6906b074afde))
* update version to 1.1.0 and enhance release script in package.json ([4076bee](https://github.com/luukderooij/Darts/commit/4076beeee3daf9514a67685ddae0ee92debb7e47))


### Bug Fixes

* specify build context and Dockerfile for frontend service in docker-compose ([2642ce1](https://github.com/luukderooij/Darts/commit/2642ce10546ea804b8facb090cd6131381ae5e99))
* specify dockerfile path for backend service in docker-compose ([f9402a1](https://github.com/luukderooij/Darts/commit/f9402a1dad083360d01bb2833158a0ae1bf3904c))
* update backend build context in docker-compose and improve volume indentation ([3177a2f](https://github.com/luukderooij/Darts/commit/3177a2fcf61759deabdb19af81d826030ee09e0a))
* update frontend build context in Docker configuration ([5cf6db3](https://github.com/luukderooij/Darts/commit/5cf6db31cc878b7089c18498e5dba3ede54fe957))
* update volume mapping and database URL in docker-compose for backend service ([106aeba](https://github.com/luukderooij/Darts/commit/106aebae67c64d21ff38372c1e7e02bd2e8f5fd6))

## [1.2.0](https://github.com/luukderooij/Darts/compare/v1.1.0...v1.2.0) (2026-01-24)


### Features

* refactor AuthContext to import User type and streamline authentication logic ([3c4068e](https://github.com/luukderooij/Darts/commit/3c4068e2a600fff81badc40e26f923db1b60768b))
* update version to 1.1.0 and enhance release script in package.json ([4076bee](https://github.com/luukderooij/Darts/commit/4076beeee3daf9514a67685ddae0ee92debb7e47))

## 1.1.0 (2026-01-24)


### Features

* Add .dockerignore file to exclude unnecessary files from Docker context ([e9c0fc7](https://github.com/luukderooij/Darts/commit/e9c0fc78c94baca4b6044d1bcd0ebcc2b1359fac))
* Add Dartboard management functionality ([a739990](https://github.com/luukderooij/Darts/commit/a739990a9fe1f9cc3596f48e729ef8a6982999c7))
* Add Dashboard component and integrate tournament fetching ([35487ee](https://github.com/luukderooij/Darts/commit/35487ee7776c28da7c81e33e26a5ef2f2a248e72))
* Add knockout phase functionality and update tournament model with qualifiers and starting legs ([cef05a7](https://github.com/luukderooij/Darts/commit/cef05a712b034910159e9a31d4337368ddb3a5e5))
* Add ManageTournament page and update routing in App ([b99a07e](https://github.com/luukderooij/Darts/commit/b99a07e19acf1eebbe21d6167abdc669a5efac14))
* add zwitch library for handling values based on a field ([1488280](https://github.com/luukderooij/Darts/commit/1488280dd49d2910e0c6f1e8b1abf7f12f7edb65))
* Enhance tournament creation and retrieval with UUID and eager loading ([4e9fa5c](https://github.com/luukderooij/Darts/commit/4e9fa5c697d73a0e2c8ca960edbbe23d2a2fbe69))
* Implement tournament creation with manual and automatic team generation ([cb0911a](https://github.com/luukderooij/Darts/commit/cb0911ae9a345cf81e2dcdbe0dc3daf66e2fd4c1))
* Select first board by default when loading boards in CreateTournament ([811b8fd](https://github.com/luukderooij/Darts/commit/811b8fdf5e75be3fd41282532a2878b123cc2296))
* Set up Docker configuration for backend and frontend services with Nginx proxy ([5f9eefc](https://github.com/luukderooij/Darts/commit/5f9eefc30fcf0a6f39563edba6a6d43b50638b52))
* **tournament:** add new fields and logic for knockout phase ([fd34384](https://github.com/luukderooij/Darts/commit/fd3438487b47ae636e1ac9a54fdf6d7782fb66d0))
* update TARGET_DIRS to include .vscode and enhance package.json release script ([5e06ea2](https://github.com/luukderooij/Darts/commit/5e06ea23dcaa13955296da5159f172637faef4e0))
* Update task configurations and add Docker setup instructions in project context ([044e567](https://github.com/luukderooij/Darts/commit/044e56796cba5ee515384260cfbcdb196c10da7b))
* Update tournament model and schemas to include date and number of poules; enhance CreateTournament component for dynamic name generation ([7b1ee1f](https://github.com/luukderooij/Darts/commit/7b1ee1fd6fbef8bfcd0032e7e882dc30a739fd75))


### Bug Fixes

* Update tasks and README for consistent development environment setup ([db9a896](https://github.com/luukderooij/Darts/commit/db9a89690a1ceed24d133e4d006bff69e96fe6e0))
