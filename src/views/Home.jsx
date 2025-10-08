import { useState } from 'react'
import { Button, Card, Progress, Avatar } from '@/components/ui'
import { CiStar } from "react-icons/ci"
import { HiOutlineUser } from 'react-icons/hi'

const Home = () => {
    const [projects, setProjects] = useState([
        {
            id: 1,
            title: "EVO SaaS",
            description: "Most of you are familiar with the virtues of a programmer",
            progress: 75,
            pm: null, // No image available
            pmName: "Alex Thompson",
            isFavorite: true
        },
        {
            id: 2,
            title: "AIA Bill App",
            description: "We are not shipping your machine!",
            progress: 45,
            pm: null, // No image available
            pmName: "Sarah Wilson",
            isFavorite: true
        },
        {
            id: 3,
            title: "Octonine POS",
            description: "Everything that can be invented has been invented.",
            progress: 90,
            pm: null, // No image available
            pmName: "Mike Chen",
            isFavorite: true
        },
        {
            id: 4,
            title: "Evo SaaS API",
            description: "Debugging is twice as hard as writing the code in the first place.",
            progress: 30,
            pm: null, // No image available
            pmName: "Emma Davis",
            isFavorite: true
        },
        {
            id: 5,
            title: "Project Alpha",
            description: "Some quick example text to build on the card title and make up the bulk of the card's content.",
            progress: 60,
            pm: null, // No image available
            pmName: "John Smith",
            isFavorite: false
        },
        {
            id: 6,
            title: "Project Beta",
            description: "Another example project with different content and progress tracking.",
            progress: 25,
            pm: null, // No image available
            pmName: "Lisa Brown",
            isFavorite: false
        }
    ])

    const toggleFavorite = (projectId) => {
        setProjects(projects.map(project => 
            project.id === projectId 
                ? { ...project, isFavorite: !project.isFavorite }
                : project
        ))
    }

    const favoriteProjects = projects.filter(project => project.isFavorite)
    const regularProjects = projects.filter(project => !project.isFavorite)

    // Generate avatar colors based on name
    const getAvatarColor = (name) => {
        const colors = [
            'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-100',
            'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100',
            'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100',
            'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100',
            'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-100',
            'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-100'
        ]
        const index = name.length % colors.length
        return colors[index]
    }

    // Get progress bar color based on percentage
    const getProgressColor = (percent) => {
        if (percent < 30) return 'bg-red-500'
        if (percent < 70) return 'bg-yellow-500'
        return 'bg-green-500'
    }

    // Get initials from name
    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }

    const ProjectCard = ({ project, isGrid = false }) => (
        <div className={isGrid ? "w-full max-w-xs" : "w-full mb-4"}>
            <Card
                clickable
                className={`h-full flex flex-col ${isGrid ? '' : 'p-4'}`}
                onClick={(e) => console.log('Card Clickable', e)}
            >
                {isGrid ? (
                    // Important section - vertical layout
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-lg font-semibold">{project.title}</h5>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleFavorite(project.id)
                                }}
                                className="focus:outline-none"
                            >
                                <CiStar 
                                    className={`text-2xl ${
                                        project.isFavorite 
                                            ? 'text-yellow-400 fill-yellow-400' 
                                            : 'text-gray-400'
                                    }`} 
                                />
                            </button>
                        </div>
                        <p className="mb-4 text-gray-600 flex-grow">{project.description}</p>
                        <div className="mt-auto">
                            <div className="mb-4">
                                <Progress 
                                    percent={project.progress} 
                                    customColorClass={getProgressColor(project.progress)}
                                />
                            </div>
                            <div className="flex items-center">
                                {project.pm ? (
                                    <Avatar src={project.pm} size="sm" />
                                ) : (
                                    <Avatar 
                                        className={`${getAvatarColor(project.pmName)}`}
                                        size="sm"
                                    >
                                        {getInitials(project.pmName)}
                                    </Avatar>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    // Projects section - horizontal layout
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                            <div className="flex-1">
                                <h5 className="text-lg font-semibold">{project.title}</h5>
                                <p className="text-sm text-gray-500">Short subtitle</p>
                            </div>
                            <div className="flex-1">
                                <Progress 
                                    percent={project.progress} 
                                    customColorClass={getProgressColor(project.progress)}
                                />
                            </div>
                            <div className="flex items-center">
                                {project.pm ? (
                                    <Avatar src={project.pm} size="sm" />
                                ) : (
                                    <Avatar 
                                        className={`${getAvatarColor(project.pmName)}`}
                                        size="sm"
                                    >
                                        {getInitials(project.pmName)}
                                    </Avatar>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(project.id)
                            }}
                            className="focus:outline-none ml-4"
                        >
                            <CiStar 
                                className={`text-2xl ${
                                    project.isFavorite 
                                        ? 'text-yellow-400 fill-yellow-400' 
                                        : 'text-gray-400'
                                }`} 
                            />
                        </button>
                    </div>
                )}
            </Card>
        </div>
    )

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <Button variant="solid">Create project</Button>
            </div>

            {/* Important Section */}
            <div>
                <h2 className="text-lg font-medium mb-4">Important</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {favoriteProjects.map(project => (
                        <ProjectCard key={project.id} project={project} isGrid={true} />
                    ))}
                </div>
            </div>

            {/* Projects Section */}
            <div>
                <h2 className="text-lg font-medium mb-4">Projects</h2>
                <div className="space-y-4">
                    {regularProjects.map(project => (
                        <ProjectCard key={project.id} project={project} isGrid={false} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Home
