FROM nginx:alpine

COPY index.html   /usr/share/nginx/html/index.html
COPY tokens.css   /usr/share/nginx/html/tokens.css
COPY styles.css   /usr/share/nginx/html/styles.css
COPY app.js       /usr/share/nginx/html/app.js
COPY events.js    /usr/share/nginx/html/events.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
