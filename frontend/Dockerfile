# frontend/Dockerfile

# Χρησιμοποιούμε κατευθείαν το Nginx (χωρίς Node.js)
FROM nginx:alpine

# Καθαρίζουμε τα default αρχεία του Nginx
RUN rm -rf /usr/share/nginx/html/*

# Αντιγράφουμε τον ΕΤΟΙΜΟ φάκελο build που έχεις στο μηχάνημά σου
# (Το Docker περιμένει να υπάρχει ο φάκελος frontend/build)
COPY build /usr/share/nginx/html

# Αντιγράφουμε το config σου
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ανοίγουμε την πόρτα 80
EXPOSE 80

# Ξεκινάμε
CMD ["nginx", "-g", "daemon off;"]
