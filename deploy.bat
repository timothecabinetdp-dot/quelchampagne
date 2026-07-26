@echo off
cd /d "%~dp0"
if not exist "build-site.mjs" ( echo ERREUR : build-site.mjs introuvable. & pause & exit /b 1 )
echo === 1/3 Construction du site ===
call node build-site.mjs || ( echo Echec du build & pause & exit /b 1 )
echo === 2/3 Controles de lancement ===
call node validate-site.mjs || ( echo Validation site en echec & pause & exit /b 1 )
call node validate-launch.mjs || ( echo Feu vert lancement non obtenu & pause & exit /b 1 )
echo === 3/3 Publication vers Netlify ===
call npx --yes netlify-cli@latest deploy --prod --dir="dist" --site=cosmic-capybara-8cee15
echo === Termine. quelchampagne.fr est a jour. ===
pause >nul
