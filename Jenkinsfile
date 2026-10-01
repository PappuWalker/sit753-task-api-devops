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
                sh 'npm ci'
                sh "docker build -t ${APP_NAME}:${BUILD_TAG} -t ${APP_NAME}:latest ."
            }
        }
        stage('2. Automated Test') {
            steps {
                echo "===> [STAGE 2] Running Jest Unit & Integration Tests..."
                sh 'npm run test:ci'
            }
            post {
                always {
                    junit testResults: 'reports/junit.xml', allowEmptyResults: true
                }
            }
        }
        stage('3. Code Quality') {
            steps {
                echo "===> [STAGE 3] SonarQube Static Analysis..."
                // Note: Ensure you have SonarQube running/configured in Jenkins
                withSonarQubeEnv('SonarQube') {
                    sh "sonar-scanner -Dsonar.projectKey=${SONAR_PROJECT} -Dsonar.sources=src"
                }
            }
        }
        stage('4. Security Scan') {
            steps {
                echo "===> [STAGE 4] Trivy Container Vulnerability Scan..."
                sh 'npm audit --audit-level=high || true'
                sh """
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                    aquasec/trivy:latest image --severity HIGH,CRITICAL --format table \
                    ${APP_NAME}:${BUILD_TAG} > trivy-report.txt
                """
            }
        }
        stage('5. Deploy to Staging') {
            steps {
                echo "===> [STAGE 5] Deploying to Staging on Port 5001..."
                sh """
                    docker stop ${APP_NAME}-staging || true
                    docker rm ${APP_NAME}-staging || true
                    docker run -d --name ${APP_NAME}-staging -p ${STAGING_PORT}:5000 ${APP_NAME}:${BUILD_TAG}
                """
                sleep 5
                sh "curl -f http://localhost:${STAGING_PORT}/health || exit 1"
            }
        }
        stage('6. Release to Production') {
            steps {
                echo "===> [STAGE 6] Promoting to Production on Port 5000 with Rollback..."
                script {
                    try {
                        sh "docker tag ${APP_NAME}:latest ${APP_NAME}:backup || true"
                        sh """
                            docker stop ${APP_NAME}-prod || true
                            docker rm ${APP_NAME}-prod || true
                            docker run -d --name ${APP_NAME}-prod -p ${PROD_PORT}:5000 ${APP_NAME}:${BUILD_TAG}
                        """
                        sleep 5
                        sh "curl -f http://localhost:${PROD_PORT}/health || exit 1"
                    } catch (Exception e) {
                        echo "!!! CRITICAL: Prod failed! Rolling back..."
                        sh "docker run -d --name ${APP_NAME}-prod -p ${PROD_PORT}:5000 ${APP_NAME}:backup"
                        error("Deployment rolled back.")
                    }
                }
            }
        }
        stage('7. Monitoring & Alerting') {
            steps {
                echo "===> [STAGE 7] Checking Prometheus Metrics..."
                sh "curl -s http://localhost:${PROD_PORT}/metrics | grep 'http_requests_total' || exit 1"
                echo "TELEMETRY: Pipeline Build #${BUILD_NUMBER} successful. App is live."
            }
        }
    }
}