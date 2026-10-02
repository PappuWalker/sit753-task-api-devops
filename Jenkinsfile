pipeline {
    agent any
    environment {
        APP_NAME        = 'simple-task-api'
        BUILD_TAG       = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
        STAGING_PORT    = '5001'
        PROD_PORT       = '5000'
        SONAR_PROJECT   = 'task_api_project'
    }
    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }
    stages {
        stage('1. Build') {
            steps {
                echo "===> [STAGE 1] Building Node.js App & Docker Image..."
                bat 'npm install'
                bat "docker build -t ${APP_NAME}:${BUILD_TAG} -t ${APP_NAME}:latest ."
            }
        }
        stage('2. Automated Test') {
            steps {
                echo "===> [STAGE 2] Running Jest Unit & Integration Tests..."
                bat 'npm run test:ci'
            }
            post {
                always {
                    junit testResults: 'reports/junit.xml', allowEmptyResults: true
                }
            }
        }
        stage('3. Code Quality') {
            steps {
                echo "===> [STAGE 3] Real SonarQube Static Analysis & Quality Gate..."
                withCredentials([string(credentialsId: 'sonar-token-local', variable: 'SONAR_TOKEN')]) {
                    bat 'npx sonarqube-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.login=%SONAR_TOKEN% -Dsonar.qualitygate.wait=true'
                }
            }
        }
        stage('4. Security Scan') {
            steps {
                echo "===> [STAGE 4] Trivy Container Vulnerability Scan & Audit..."
                bat 'npm audit --audit-level=high'
                bat "docker run --rm -v //var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --format table ${APP_NAME}:${BUILD_TAG}"
                bat "docker run --rm -v //var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity CRITICAL --ignore-unfixed --exit-code 1 ${APP_NAME}:${BUILD_TAG}"
            }
        }
        stage('5. Deploy to Staging') {
            steps {
                echo "===> [STAGE 5] Deploying to Staging on Port 5001..."
                bat 'docker rm -f simple-task-api-staging || exit 0'
                withEnv(["IMAGE=${APP_NAME}:${BUILD_TAG}"]) {
                    bat 'docker-compose up -d staging'
                }
                sleep 5
                bat "curl -f http://localhost:${STAGING_PORT}/health || exit 1"
            }
        }
        stage('6. Release to Production') {
            steps {
                echo "===> [STAGE 6] Promoting to Production on Port 5000 with Real Rollback..."
                script {
                    def previous = ''
                    try {
                        previous = bat(returnStdout: true, script: '@docker inspect --format "{{.Config.Image}}" simple-task-api-prod').trim()
                        echo "Current production image: ${previous}"
                    } catch (e) {
                        echo 'No production container yet - first release'
                    }
                    try {
                        bat 'docker rm -f simple-task-api-prod || exit 0'
                        withEnv(["IMAGE=${APP_NAME}:${BUILD_TAG}"]) {
                            bat 'docker-compose up -d prod'
                        }
                        sleep 5
                        bat 'curl -f http://localhost:5000/healthz'
                    } catch (e) {
                        echo "!!! Release failed - rolling back to ${previous}"
                        if (previous) {
                            bat 'docker rm -f simple-task-api-prod || exit 0'
                            withEnv(["IMAGE=${previous}"]) {
                                bat 'docker-compose up -d prod'
                            }
                        }
                        error 'Release failed - production rolled back'
                    }
                }
            }
        }
        stage('7. Monitoring & Alerting') {
            steps {
                echo "===> [STAGE 7] Prometheus monitoring + alert rules..."
                bat 'docker rm -f prometheus || exit 0'
                bat 'docker run -d --name prometheus -p 9090:9090 -v "%WORKSPACE%\\monitoring:/etc/prometheus" prom/prometheus:v2.53.2'
                sleep 15
                powershell '''
                  $t = Invoke-RestMethod http://localhost:9090/api/v1/targets
                  $prod = $t.data.activeTargets | Where-Object { $_.labels.job -eq 'task-api-prod' }
                  if ($prod.health -ne 'up') { throw 'Prometheus reports production DOWN' }
                  Write-Host 'Prometheus is scraping production: UP'
                  $r = Invoke-RestMethod http://localhost:9090/api/v1/rules
                  Write-Host ('Alert rules loaded: ' + (($r.data.groups | ForEach-Object { $_.rules.name }) -join ', '))
                '''
                bat "curl -s http://localhost:${PROD_PORT}/metrics > metrics.txt"
                bat "findstr http_requests_total metrics.txt || exit 1"
                echo "TELEMETRY: Pipeline Build #${BUILD_NUMBER} successful. App is live."
            }
        }
    }

    post {
        failure {
            withCredentials([string(credentialsId: 'discord-webhook', variable: 'HOOK')]) {
                powershell '''
                  $body = @{ content = "🚨 **ALERT:** Jenkins build $env:BUILD_NUMBER FAILED! 🚨 Check logs: $env:BUILD_URL" } | ConvertTo-Json -Depth 10
                  Invoke-RestMethod -Uri $env:HOOK -Method Post -ContentType 'application/json' -Body $body
                '''
            }
        }
        success {
            withCredentials([string(credentialsId: 'discord-webhook', variable: 'HOOK')]) {
                powershell '''
                  $body = @{ content = "✅ **SUCCESS:** Jenkins build $env:BUILD_NUMBER passed all 7 DevSecOps stages and is LIVE! 🚀" } | ConvertTo-Json -Depth 10
                  Invoke-RestMethod -Uri $env:HOOK -Method Post -ContentType 'application/json' -Body $body
                '''
            }
        }
    }
}