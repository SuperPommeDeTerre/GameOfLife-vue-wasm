FROM node:lts-alpine AS build-stage-0
# make the 'app' folder the current working directory
WORKDIR /app
# copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./
# install project dependencies
RUN npm install
# copy project files and folders to the current working directory (i.e. 'app' folder)
COPY . .
# build app for production with minification
RUN npm run build

FROM httpd:2.4-bookworm AS production
RUN apt update \
    && apt upgrade -y \
    && apt install --no-install-recommends -y ca-certificates libapache2-mod-auth-openidc \
    && apt clean
COPY --from=build-stage-0 /app/dist /usr/local/apache2/htdocs/
# Add our execution user
RUN adduser --system --group pdc-ui
USER pdc-ui
EXPOSE 443
HEALTHCHECK --interval=1m --timeout=30s --retries=3 CMD curl --fail https://localhost:443 || exit 1
